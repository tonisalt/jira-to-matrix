/* eslint-disable camelcase */
const dict = Object.freeze({
    notAdmin: 'User "%{sender}" don\'t have admin status for this command',
    setBotToAdmin: 'Incorrect bot status in project [%{projectKey}](%viewUrl), ask admin for help',
    noRulesToWatchIssue: 'Bot don\'t have permission to watch or make actions in this Jira issue',
    comment_created: 'commented',
    comment_updated: 'changed comment',
    issue_updated: 'changed issue',
    issueHasChanged: 'Task was changed',
    statusHasChanged: '%{key} "%{summary}" now has status "%{status}"',
    statusHasChangedMessage: '%{name} changed a linked issue status [%{key} "%{summary}"](%{viewUrl}) to **%{status}**',
    newIssueInEpic: 'New issue in epic',
    issueAddedToEpic: 'An issue [%{key} %{summary}](%{viewUrl}) was added to the epic',
    newLink: 'New link',
    newLinkMessage: 'A new link. This issue **%{relation}** [%{key} "%{summary}"](%{viewUrl})',
    deleteLink: 'Delete link',
    deleteLinkMessage: 'Link deleted. This issue **%{relation}** [%{key} "%{summary}"](%{viewUrl})',
    miss: 'missing',
    epicAddedToProject: 'An epic [%{key} %{summary}](%{viewUrl}) was added to the project',
    newEpicInProject: 'New epic in project',
    statusEpicChanged: 'Epic was changed',
    statusEpicChangedMessage: '%{name} changed a linked epic status [%{key} "%{summary}"](%{viewUrl}) to **%{status}**',
    errorMatrixCommands: 'Something went wrong! Your request failed, please try again.',
    errorMatrixAssign: 'FATAL ERROR! User "%{userToFind}" don\'t exist.',
    successMatrixInvite: 'User %{sender} invited in room %{roomName}',
    successMatrixAssign: 'User "%{displayName}" appointed assignee',
    emptyMatrixComment: 'Add comment body',
    listUsers: 'List users',
    successMatrixComment: 'Comment published',
    listJiraCommand: 'List of available commands',
    errorMoveJira: 'ERROR! Transition is failed<br>Try again',
    successMoveJira: 'Issue status changed by user %{sender} to %{name}',
    errorWatcherJira: 'The watcher is not added! Check user name and try again',
    successWatcherJira: 'Watcher was added',
    notFoundUser: 'User %{user} is not in current room',
    notFoundRoom: 'Room "%{roomName}" is not found',
    notFoundPrio: 'New priority with name "%{bodyText}" is not found',
    setPriority: 'Now issue has the priority %{name}',
    successUserKick: 'User %{user} is kicked from room %{roomName}',
    errorUserKick: 'Error kicking user %{user} from room %{roomName}',
    kickInfo: 'User %{sender} has kicked next members from rooms:',
});

module.exports.dict = dict;
