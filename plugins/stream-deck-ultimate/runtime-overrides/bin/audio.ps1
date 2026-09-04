param(
  [ValidateSet("List","State","Switch","Cycle","MicToggle","MicSet","VolumeSet","VolumeAdjust")]
  [string]$Action = "State",
  [ValidateSet("output","input")]
  [string]$Flow = "output",
  [string]$Match = "",
  [int]$Step = 1,
  [double]$Value = 50,
  [double]$Delta = 0,
  [string]$Muted = ""
)

$ErrorActionPreference = "Stop"

if (-not ("PackRatAudio.Core" -as [type])) {
  Add-Type -Language CSharp -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

namespace PackRatAudio {
  public enum EDataFlow { Render=0, Capture=1, All=2 }
  public enum ERole { Console=0, Multimedia=1, Communications=2 }
  [Flags] public enum DeviceState : uint { Active=1, Disabled=2, NotPresent=4, Unplugged=8, All=15 }
  [Flags] public enum CLSCTX : uint { InprocServer=1, InprocHandler=2, LocalServer=4, RemoteServer=16, All=23 }
  public enum StorageAccessMode : uint { Read=0, Write=1, ReadWrite=2 }

  [StructLayout(LayoutKind.Explicit)]
  public struct PropVariant {
    [FieldOffset(0)] public ushort vt;
    [FieldOffset(8)] public IntPtr pointerValue;
    public string GetValue() { return vt == 31 && pointerValue != IntPtr.Zero ? Marshal.PtrToStringUni(pointerValue) : null; }
  }

  [StructLayout(LayoutKind.Sequential)] public struct PropertyKey { public Guid fmtid; public uint pid; }

  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(EDataFlow dataFlow, DeviceState stateMask, out IMMDeviceCollection ppDevices);
    int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppEndpoint);
    int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string pwstrId, out IMMDevice ppDevice);
    int RegisterEndpointNotificationCallback(IntPtr pClient);
    int UnregisterEndpointNotificationCallback(IntPtr pClient);
  }

  [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceCollection {
    int GetCount(out uint pcDevices);
    int Item(uint nDevice, out IMMDevice ppDevice);
  }

  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid iid, CLSCTX dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    int OpenPropertyStore(StorageAccessMode stgmAccess, out IPropertyStore ppProperties);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
    int GetState(out DeviceState pdwState);
  }

  [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPropertyStore {
    int GetCount(out uint cProps);
    int GetAt(uint iProp, out PropertyKey pkey);
    int GetValue(ref PropertyKey key, out PropVariant pv);
    int SetValue(ref PropertyKey key, ref PropVariant pv);
    int Commit();
  }

  [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr pNotify);
    int UnregisterControlChangeNotify(IntPtr pNotify);
    int GetChannelCount(out uint channelCount);
    int SetMasterVolumeLevel(float levelDB, Guid eventContext);
    int SetMasterVolumeLevelScalar(float level, Guid eventContext);
    int GetMasterVolumeLevel(out float levelDB);
    int GetMasterVolumeLevelScalar(out float level);
    int SetChannelVolumeLevel(uint channelNumber, float levelDB, Guid eventContext);
    int SetChannelVolumeLevelScalar(uint channelNumber, float level, Guid eventContext);
    int GetChannelVolumeLevel(uint channelNumber, out float levelDB);
    int GetChannelVolumeLevelScalar(uint channelNumber, out float level);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool isMuted, Guid eventContext);
    int GetMute(out bool isMuted);
    int GetVolumeStepInfo(out uint step, out uint stepCount);
    int VolumeStepUp(Guid eventContext);
    int VolumeStepDown(Guid eventContext);
    int QueryHardwareSupport(out uint hardwareSupportMask);
    int GetVolumeRange(out float volumeMinDB, out float volumeMaxDB, out float volumeIncrementDB);
  }

  public class DeviceInfo { public string id; public string name; public bool isDefault; }
  public class StateInfo { public DeviceInfo output; public DeviceInfo input; public bool micMuted; public double volume; }

  public static class Core {
    static readonly Guid EnumeratorClsid = new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E");
    static readonly Guid PolicyConfigClsid = new Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9");
    static readonly Guid EndpointVolumeIid = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
    static readonly PropertyKey FriendlyNameKey = new PropertyKey { fmtid=new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"), pid=14 };

    static IMMDeviceEnumerator Enumerator() {
      var t = Type.GetTypeFromCLSID(EnumeratorClsid, true);
      return (IMMDeviceEnumerator)Activator.CreateInstance(t);
    }

    static IMMDevice Default(EDataFlow flow) {
      IMMDevice d; var hr = Enumerator().GetDefaultAudioEndpoint(flow, ERole.Multimedia, out d);
      if (hr != 0 || d == null) throw new Exception("Default audio endpoint unavailable: " + hr);
      return d;
    }

    static string Id(IMMDevice d) { string id; d.GetId(out id); return id; }
    static string Name(IMMDevice d) {
      IPropertyStore s; d.OpenPropertyStore(StorageAccessMode.Read, out s);
      var key=FriendlyNameKey; PropVariant pv; s.GetValue(ref key, out pv); return pv.GetValue();
    }
    static IAudioEndpointVolume EndpointVolume(IMMDevice d) {
      var iid=EndpointVolumeIid; object o; var hr=d.Activate(ref iid, CLSCTX.All, IntPtr.Zero, out o);
      if (hr != 0 || o == null) throw new Exception("Endpoint volume unavailable: " + hr);
      return (IAudioEndpointVolume)o;
    }
    static bool SameId(string a, string b) { return string.Equals(a,b,StringComparison.OrdinalIgnoreCase); }

    public static DeviceInfo[] List(EDataFlow flow) {
      var e=Enumerator(); IMMDeviceCollection c; var hr=e.EnumAudioEndpoints(flow, DeviceState.Active, out c);
      if (hr != 0 || c == null) return new DeviceInfo[0];
      string defId = ""; try { defId=Id(Default(flow)); } catch {}
      uint n; c.GetCount(out n); var list=new List<DeviceInfo>();
      for(uint i=0;i<n;i++){ IMMDevice d; c.Item(i,out d); var id=Id(d); list.Add(new DeviceInfo{id=id,name=Name(d),isDefault=SameId(id,defId)}); }
      return list.ToArray();
    }

    static IMMDevice Find(EDataFlow flow, string match) {
      if (string.IsNullOrEmpty(match)) return Default(flow);
      var e = Enumerator(); IMMDeviceCollection c;
      e.EnumAudioEndpoints(flow, DeviceState.Active, out c);
      uint n; c.GetCount(out n);
      IMMDevice sub = null;
      for (uint i=0;i<n;i++) {
        IMMDevice d; c.Item(i, out d);
        var id = Id(d); var nm = Name(d) ?? "";
        if (string.Equals(id, match, StringComparison.OrdinalIgnoreCase) || string.Equals(nm, match, StringComparison.OrdinalIgnoreCase)) return d;
        if (sub == null && nm.IndexOf(match, StringComparison.OrdinalIgnoreCase) >= 0) sub = d;
      }
      if (sub != null) return sub;
      throw new Exception("Audio device not found: " + match);
    }

    public static bool GetMuteOn(EDataFlow flow, string match) { bool muted; EndpointVolume(Find(flow, match)).GetMute(out muted); return muted; }
    public static void SetMuteOn(EDataFlow flow, string match, bool muted) { EndpointVolume(Find(flow, match)).SetMute(muted, Guid.Empty); }
    public static bool ToggleMuteOn(EDataFlow flow, string match) { bool next = !GetMuteOn(flow, match); SetMuteOn(flow, match, next); return next; }
    public static string ResolvedName(EDataFlow flow, string match) { return Name(Find(flow, match)); }

    public static DeviceInfo GetDefault(EDataFlow flow) { var d=Default(flow); return new DeviceInfo { id=Id(d), name=Name(d), isDefault=true }; }
    public static bool GetMute(EDataFlow flow) { bool muted; EndpointVolume(Default(flow)).GetMute(out muted); return muted; }
    public static void SetMute(EDataFlow flow, bool muted) { EndpointVolume(Default(flow)).SetMute(muted, Guid.Empty); }
    public static bool ToggleMute(EDataFlow flow) { bool next=!GetMute(flow); SetMute(flow,next); return next; }
    public static double GetVolume(EDataFlow flow) { float v; EndpointVolume(Default(flow)).GetMasterVolumeLevelScalar(out v); return Math.Round(v*100.0,1); }
    public static double SetVolume(EDataFlow flow, double value) { float v=(float)Math.Max(0,Math.Min(1,value/100.0)); EndpointVolume(Default(flow)).SetMasterVolumeLevelScalar(v,Guid.Empty); return Math.Round(v*100.0,1); }

    public static DeviceInfo Switch(EDataFlow flow, string match) {
      var items=List(flow); DeviceInfo chosen=null;
      foreach(var item in items) {
        if (string.Equals(item.id,match,StringComparison.OrdinalIgnoreCase) || string.Equals(item.name,match,StringComparison.OrdinalIgnoreCase)) { chosen=item; break; }
        if (chosen==null && item.name!=null && item.name.IndexOf(match,StringComparison.OrdinalIgnoreCase)>=0) chosen=item;
      }
      if (chosen==null) throw new Exception("Audio device not found: "+match);
      SetDefault(chosen.id); chosen.isDefault=true; return chosen;
    }

    public static DeviceInfo Cycle(EDataFlow flow, int step) {
      var items=List(flow); if(items.Length==0) throw new Exception("No active audio devices");
      int current=0; for(int i=0;i<items.Length;i++) if(items[i].isDefault) { current=i; break; }
      int next=((current+step)%items.Length+items.Length)%items.Length; SetDefault(items[next].id); items[next].isDefault=true; return items[next];
    }

    static void SetDefault(string id) {
      var t=Type.GetTypeFromCLSID(PolicyConfigClsid,true); dynamic p=Activator.CreateInstance(t);
      p.SetDefaultEndpoint(id,ERole.Console); p.SetDefaultEndpoint(id,ERole.Multimedia); p.SetDefaultEndpoint(id,ERole.Communications);
    }
  }
}
"@
}

$df = if ($Flow -eq "input") { [PackRatAudio.EDataFlow]::Capture } else { [PackRatAudio.EDataFlow]::Render }
switch ($Action) {
  "List" { [PackRatAudio.Core]::List($df) | ConvertTo-Json -Compress }
  "State" { [pscustomobject]@{ output=[PackRatAudio.Core]::GetDefault([PackRatAudio.EDataFlow]::Render); input=[PackRatAudio.Core]::GetDefault([PackRatAudio.EDataFlow]::Capture); micMuted=[PackRatAudio.Core]::GetMute([PackRatAudio.EDataFlow]::Capture); volume=[PackRatAudio.Core]::GetVolume([PackRatAudio.EDataFlow]::Render) } | ConvertTo-Json -Compress }
  "Switch" { [PackRatAudio.Core]::Switch($df,$Match) | ConvertTo-Json -Compress }
  "Cycle" { [PackRatAudio.Core]::Cycle($df,$Step) | ConvertTo-Json -Compress }
  "MicToggle" { [pscustomobject]@{ micMuted=[PackRatAudio.Core]::ToggleMuteOn([PackRatAudio.EDataFlow]::Capture,$Match); micDevice=[PackRatAudio.Core]::ResolvedName([PackRatAudio.EDataFlow]::Capture,$Match) } | ConvertTo-Json -Compress }
  "MicSet" { $m=$Muted -match '^(1|true|yes|on)$'; [PackRatAudio.Core]::SetMuteOn([PackRatAudio.EDataFlow]::Capture,$Match,$m); [pscustomobject]@{ micMuted=$m; micDevice=[PackRatAudio.Core]::ResolvedName([PackRatAudio.EDataFlow]::Capture,$Match) } | ConvertTo-Json -Compress }
  "VolumeSet" { [pscustomobject]@{ volume=[PackRatAudio.Core]::SetVolume($df,$Value) } | ConvertTo-Json -Compress }
  "VolumeAdjust" { $v=[PackRatAudio.Core]::GetVolume($df); [pscustomobject]@{ volume=[PackRatAudio.Core]::SetVolume($df,$v+$Delta) } | ConvertTo-Json -Compress }
}
