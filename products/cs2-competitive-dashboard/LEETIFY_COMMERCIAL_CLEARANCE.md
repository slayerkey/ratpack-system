# Leetify Commercial Release Clearance

Status: PENDING
Approval-Date: PENDING
Approval-Channel: PENDING
Approval-Scope: PENDING
Approval-Reference: PENDING
Attribution-Asset-Source: PENDING
Additional-Conditions: PENDING

## Why this exists

CS2 Competitive Dashboard Pro is a paid $14.99 Stream Deck product. Leetify's current public Developer Guidelines require the official unmodified **Data Provided by Leetify** logo, linkback, faithful metric presentation, and no persistent storage of returned API data. The public guideline does not explicitly answer whether a monetized third-party application may sell access to a product that includes Leetify-backed views.

Before marking this file `Status: CLEARED`, obtain a written answer from Leetify that clearly covers the exact PackRat product model below.

## Copy-paste clearance request

> Hi! I'm preparing a paid third-party Stream Deck plugin called **CS2 Competitive Dashboard Pro** at **$14.99 one time** and want to make sure the release follows Leetify's Public API rules correctly.
>
> Customers provide **their own Leetify API key**. The plugin calls Leetify directly from the customer's PC; PackRat does not proxy the API or provide a shared Leetify key. Returned Leetify profile data is kept only in the live in-memory dashboard state and is not permanently stored by PackRat.
>
> The plugin will use Leetify's **official unmodified “Data Provided by Leetify” asset** linked to `https://leetify.com/`, provide **View on Leetify** links for provider-backed values, and present Leetify metrics without renaming, rescaling, or recalculating them.
>
> Is selling this $14.99 third-party plugin with those Leetify-backed views permitted under the Leetify Public API / Developer Guidelines? If there are any additional commercial-use requirements, could you tell me what needs to be added before release?

A clear written yes to this model is enough. Do not infer approval from silence, an unrelated API-key approval, or another third-party site's existence.

## Official attribution asset

Leetify's Developer Guidelines link the official badge package through the public **4. Badges** Google Drive folder:

`https://drive.google.com/drive/folders/1FkJf6iseD3AOFtnOhyGkRp1fea_gKima?ref=leetify.com`

For the dark PackRat Property Inspector, use the official **Primary (white and pink) / dark-background** version. Do not redraw, recolor, crop, animate, trace, or substitute a badge copied from another third-party site.

Place the official SVG at:

```text
products/cs2-competitive-dashboard/plugin/static/ui/leetify-provided-dark.svg
```

The build already detects that exact file and replaces the development text placeholder with the official badge. `npm run release:final` refuses to pass without it.

## Evidence to record after approval

When written approval arrives, replace the structured fields at the top of this file:

* `Status: CLEARED`
* `Approval-Date:` the date of the written approval, preferably `YYYY-MM-DD`
* `Approval-Channel:` the Leetify contact or official channel that supplied it
* `Approval-Scope:` explicitly state that the approved scope includes the **$14.99 one-time paid product** and **customer-owned Leetify API-key** model
* `Approval-Reference:` a durable link, message ID, ticket ID, or screenshot/file reference to the written response
* `Attribution-Asset-Source:` where the exact official badge file was obtained, preferably the official Leetify badge package/folder
* `Additional-Conditions:` record Leetify's extra conditions, or `NONE` if the approval had no additional requirements

`release:final` checks these fields when `Status: CLEARED`; changing only the status line is intentionally not enough to release the product.

Do not put credentials, API keys, private tokens, or unrelated personal information in this file.

## Official references

* Developer Guidelines: https://leetify.com/blog/leetify-api-developer-guidelines/
* Public API docs: https://api-public-docs.cs-prod.leetify.com/
* Developer key page: https://leetify.com/app/developer
* Official badge folder: https://drive.google.com/drive/folders/1FkJf6iseD3AOFtnOhyGkRp1fea_gKima?ref=leetify.com
* Developer Guidelines contact channel: https://discord.gg/UNygC8BAVg
