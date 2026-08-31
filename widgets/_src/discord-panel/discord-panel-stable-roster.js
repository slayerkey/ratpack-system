/* Keep Voice Panel member placement stable while speaking state changes.
 *
 * The original prototype promoted active/recent speakers to the front of the
 * rendered roster. On a two-column XENEON layout that made people jump between
 * left/right slots whenever the active speaker changed. A persistent hardware
 * roster is easier to scan when identity owns the slot and speaking only owns
 * the highlight.
 */

sortedMembers = function () {
  return model.members.slice().sort(function (left, right) {
    var leftOrder = Number(left && left._order);
    var rightOrder = Number(right && right._order);
    if (!isFinite(leftOrder)) leftOrder = 0;
    if (!isFinite(rightOrder)) rightOrder = 0;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    var leftId = currentUserId(left);
    var rightId = currentUserId(right);
    if (leftId < rightId) return -1;
    if (leftId > rightId) return 1;
    return 0;
  });
};
