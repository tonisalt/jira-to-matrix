const htmlToText = require('html-to-text').fromString;
const Ramda = require('ramda');
const logger = require('../../modules/log.js')(module);
const translate = require('../../locales');
const marked = require('marked');
const {usersToIgnore, testMode} = require('../../config');
const utils = require('../../lib/utils.js');
const jiraRequests = require('../../lib/jira-request.js');

const getEpicInfo = epicLink =>
    ((epicLink === translate('miss'))
        ? ''
        : `            <br>Epic link:
                ${utils.getOpenedDescriptionBlock(epicLink)}
                ${utils.getClosedDescriptionBlock(utils.getViewUrl(epicLink))}`);

const getPost = description => {
    const post = `
            Assignee:
                ${utils.getOpenedDescriptionBlock(description.assigneeName)}
                ${utils.getClosedDescriptionBlock(description.assigneeEmail)}
            <br>Reporter:
                ${utils.getOpenedDescriptionBlock(description.reporterName)}
                ${utils.getClosedDescriptionBlock(description.reporterEmail)}
            <br>Type:
                ${utils.getClosedDescriptionBlock(description.typeName)}
            <br>Estimate time:
                ${utils.getClosedDescriptionBlock(description.estimateTime)}
            <br>Description:
                ${utils.getClosedDescriptionBlock(htmlToText(description.description))}
            <br>Priority:
                ${utils.getClosedDescriptionBlock(description.priority)}`;

    const epicInfo = getEpicInfo(description.epicLink);

    return [post, epicInfo].join('\n');
};

const helper = {
    getDescription: async issue => {
        try {
            const {description} = await jiraRequests.getRenderedValues(issue.id, ['description']);
            const htmlBody = getPost({...issue.descriptionFields, description});
            const body = htmlToText(htmlBody);

            return {body, htmlBody};
        } catch (err) {
            throw utils.errorTracing('getDescription', err);
        }
    },

    isAvailabledIssue: async issueKey => {
        const projectKey = utils.getProjectKeyFromIssueKey(issueKey);
        const projectBody = await jiraRequests.getProject(projectKey);

        return !utils.isIgnoreProject(projectBody) || jiraRequests.getIssueSafety(issueKey);
    },

    getHookHandler: type => {
        const handlers = {
            issue: async body => {
                const key = utils.getIssueKey(body);
                const status = await helper.isAvailabledIssue(key);

                return !status;
            },
            issuelink: async body => {
                const allId = [utils.getIssueLinkSourceId(body), utils.getIssueLinkDestinationId(body)];
                const issues = await Promise.all(allId.map(jiraRequests.getIssueSafety));

                return !issues.some(Boolean);
            },
            project: async body => {
                const key = utils.getProjectKey(body);
                const projectBody = await jiraRequests.getProject(key);
                return utils.isIgnoreProject(projectBody);
            },
            comment: async body => {
                const id = utils.getIssueId(body);
                const status = await jiraRequests.getIssueSafety(id);

                return !status;
            },
        };

        return handlers[type];
    },

    getIgnoreStatus: body => {
        const type = utils.getHookType(body);
        const handler = helper.getHookHandler(type);

        return handler && handler(body);
    },

    getIgnoreBodyData: body => {
        const username = utils.getHookUserName(body);
        const creator = utils.getCreator(body);

        const isInUsersToIgnore = arr =>
            [username, creator].some(user => arr.includes(user));

        const userIgnoreStatus = testMode.on ? !isInUsersToIgnore(testMode.users) : isInUsersToIgnore(usersToIgnore);
        const ignoreStatus = userIgnoreStatus;

        return {username, creator, ignoreStatus};
    },

    getIgnoreProject: async body => {
        await jiraRequests.testJiraRequest();

        const ignoreStatus = await helper.getIgnoreStatus(body);
        const webhookEvent = utils.getBodyWebhookEvent(body);
        const timestamp = utils.getBodyTimestamp(body);
        const issueName = utils.getIssueName(body);

        return {timestamp, webhookEvent, ignoreStatus, issueName};
    },

    getIgnoreInfo: async body => {
        const userStatus = helper.getIgnoreBodyData(body);
        const projectStatus = await helper.getIgnoreProject(body);
        const status = userStatus.ignoreStatus || projectStatus.ignoreStatus;

        return {userStatus, projectStatus, status};
    },

    getMembersUserId: members => members.map(({userId}) => userId),

    getEpicChangedMessageBody: ({summary, key, status, name}) => {
        const viewUrl = utils.getViewUrl(key);
        const values = {name, key, summary, status, viewUrl};

        const body = translate('statusEpicChanged');
        const message = translate('statusEpicChangedMessage', values, values.name);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },

    getNewEpicMessageBody: ({key, summary}) => {
        const viewUrl = utils.getViewUrl(key);
        const values = {key, summary, viewUrl};

        const body = translate('newEpicInProject');
        const message = translate('epicAddedToProject', values, values.name);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },
    getPostStatusData: data => {
        if (!data.status) {
            logger.warn('No status in getPostStatusData');

            return {};
        }

        const viewUrl = utils.getViewUrl(data.key);

        const body = translate('statusHasChanged', {...data, viewUrl});
        const message = translate('statusHasChangedMessage', {...data, viewUrl}, data.name);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },

    getNewIssueMessageBody: ({summary, key}) => {
        const viewUrl = utils.getViewUrl(key);
        const values = {key, viewUrl, summary};

        const body = translate('newIssueInEpic');
        const message = translate('issueAddedToEpic', values);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },

    fieldNames: items =>
        items.reduce((acc, {field}) =>
            (field ? [...acc, field] : acc), []),

    itemsToString: items =>
        items.reduce((acc, {field, toString}) =>
            (field ? {...acc, [field]: toString} : acc), {}),

    composeText: ({author, fields, formattedValues}) => {
        const message = translate('issue_updated', {name: author});
        const changesDescription = fields.map(field =>
            `${field}: ${formattedValues[field]}`);

        return [message, ...changesDescription].join('<br>');
    },

    getIssueUpdateInfoMessageBody: async ({changelog, key, user}) => {
        const author = user.displayName;
        const fields = helper.fieldNames(changelog.items);
        const renderedValues = await jiraRequests.getRenderedValues(key, fields);

        const changelogItemsTostring = helper.itemsToString(changelog.items);
        const formattedValues = {...changelogItemsTostring, ...renderedValues};

        const htmlBody = helper.composeText({author, fields, formattedValues});
        const body = translate('issueHasChanged');

        return {htmlBody, body};
    },

    getCommentHTMLBody: (headerText, commentBody) => `${headerText}: <br>${commentBody}`,

    getCommentBody: (issue, comment) => {
        const comments = Ramda.path(['renderedFields', 'comment', 'comments'], issue);

        const result = Ramda.propOr(
            comment.body,
            'body',
            Ramda.find(Ramda.propEq('id', comment.id), comments)
        );

        return result;
    },

    getPostLinkMessageBody: ({relation, related}, action = 'newLink') => {
        const key = utils.getKey(related);
        const viewUrl = utils.getViewUrl(key);
        const summary = utils.getSummary(related);
        const values = {key, relation, summary, viewUrl};

        const body = translate(action);
        const htmlBodyAction = related ? `${action}Message` : action;

        const message = translate(htmlBodyAction, values);
        const htmlBody = marked(message);

        return {body, htmlBody};
    },
};

module.exports = helper;