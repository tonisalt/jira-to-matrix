const Ramda = require('ramda');
const jira = require('../jira');
const translate = require('../locales');
const {composeRoomName} = require('../matrix').helpers;
const logger = require('debug')('bot post issue update');

const helpers = {
    fieldNames: items => Ramda.pipe(
        Ramda.map(Ramda.prop('field')),
        Ramda.uniq
    )(items || []),

    toStrings: items => items.reduce(
        (result, item) => Ramda.merge(result, {[item.field]: item.toString}),
        {}
    ),
};

const composeText = ({author, fields, formattedValues}) => {
    const messageHeader = () => `${author} ${translate('issue_updated', null, author)}`;
    const changesDescription = () => fields.map(
        field => `${field}: ${formattedValues[field]}`
    );
    return [messageHeader(author)]
        .concat(changesDescription(fields, formattedValues))
        .join('<br>');
};

const postUpdateInfo = async (mclient, roomID, hook) => {
    const {changelog, issue, user} = hook;
    const fields = helpers.fieldNames(changelog.items);
    const formattedValues = Object.assign(
        {},
        helpers.toStrings(changelog.items),
        await jira.issue.renderedValues(issue.key, fields)
    );
    const success = await mclient.sendHtmlMessage(
        roomID,
        translate('issueHasChanged'),
        composeText({
            author: Ramda.path(['displayName'], user),
            fields,
            formattedValues,
        })
    );
    if (success) {
        logger(`Posted updates to ${issue.key}`);
    }
};

const getIssueKey = hook => {
    const fieldKey = jira.getChangelogField('Key', hook);
    return fieldKey ? fieldKey.fromString : hook.issue.key;
};

const move = async (mclient, roomID, hook) => {
    const field = jira.getChangelogField('Key', hook);
    if (!field) {
        return;
    }
    const success = await mclient.createAlias(field.toString, roomID);
    if (success) {
        logger(`Successfully added alias ${field.toString} for room ${field.fromString}`);
    }
    await mclient.setRoomTopic(roomID, jira.issue.ref(hook.issue.key));
};

const rename = async (mclient, roomID, hook) => {
    const fieldIsEmpty = field => !jira.getChangelogField(field, hook);
    if (fieldIsEmpty('summary') && fieldIsEmpty('Key')) {
        return;
    }
    const success = await mclient.setRoomName(
        roomID,
        composeRoomName(hook.issue)
    );
    if (success) {
        logger(`Successfully renamed room ${getIssueKey(hook)}`);
    }
};

const postChanges = async ({mclient, body}) => {
    if (
        Ramda.isEmpty(Ramda.pathOr([], ['changelog', 'items'], body))
    ) {
        return;
    }
    const roomID = await mclient.getRoomId(getIssueKey(body));
    if (!roomID) {
        return;
    }
    await move(mclient, roomID, body);
    await rename(mclient, roomID, body);
    await postUpdateInfo(mclient, roomID, body);
};

const shouldPostChanges = ({body, mclient}) => Boolean(
    typeof body === 'object'
    && body.webhookEvent === 'jira:issue_updated'
    && typeof body.changelog === 'object'
    && typeof body.issue === 'object'
    && mclient
);

const middleware = async req => {
    const proceed = shouldPostChanges(req);

    if (req.body.issue) {
        logger(`To update the data of the issue ${req.body.issue.key}: ${proceed}\n`);
    } else {
        logger(`To update the data ${req.body.webhookEvent}: ${proceed}\n`);
    }

    if (proceed) {
        await postChanges(req);
    }
};

module.exports.middleware = middleware;
module.exports.shouldPostChanges = shouldPostChanges;
module.exports.forTests = {
    toStrings: helpers.toStrings,
    composeText,
};
