const logger = require('../../../modules/log')(module);
const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const utils = require('../../../lib/utils.js');

const helper = {
    getInviteUser: (name, room) => {
        const user = utils.getMatrixUserID(name);

        return helper.isMember(room, user) ? false : user;
    },

    isMember: (room, userIdMatrix) => {
        const members = room.getJoinedMembers();
        return members.some(({userId}) => userId === userIdMatrix);
    },

    // Checking occurrences of current name
    checkUser: ({name, displayName}, expectedName) =>
        name.toLowerCase().includes(expectedName.toLowerCase())
        || displayName.toLowerCase().includes(expectedName.toLowerCase()),

    // Search users by part of name
    searchUser: async name => {
        if (!name) {
            return [];
        }
        const allUsers = await jiraRequests.getUsersByParam(name);

        return allUsers.reduce((prev, cur) =>
            (helper.checkUser(cur, name) ? [...prev, cur] : prev),
        []);
    },

    // Parse body of event from Matrix
    parseEventBody: body => {
        try {
            const trimedBody = body.trim();

            const commandName = trimedBody
                .split(' ')[0]
                .match(/^!\w+$/g)[0]
                .substring(1);

            if (`!${commandName}` === trimedBody) {
                return {commandName};
            }

            const bodyText = trimedBody
                .replace(`!${commandName}`, '')
                .trim();

            return {commandName, bodyText};
        } catch (err) {
            return {};
        }
    },

    addToWatchers: async (room, roomName, name, matrixClient) => {
        try {
            await jiraRequests.addWatcher(name, roomName);
            const inviteUser = helper.getInviteUser(name, room);

            if (inviteUser) {
                await matrixClient.invite(room.roomId, inviteUser);
            }
        } catch (err) {
            throw utils.errorTracing('addToWatchers', err);
        }
    },

    addToAssignee: async (room, roomName, name, matrixClient) => {
        try {
            await jiraRequests.addAssignee(name, roomName);
            const inviteUser = helper.getInviteUser(name, room);
            if (inviteUser) {
                await matrixClient.invite(room.roomId, inviteUser);
            }
        } catch (err) {
            throw utils.errorTracing('addToAssignee', err);
        }
    },

    // should get room info, timestamp and date of event, and all members except jira-bot
    parseRoom: (acc, room) => {
        const {roomId, name: roomName} = room;
        const members = utils.getMembersExceptBot(room.getJoinedMembers());
        const [lastEvent] = room.timeline.slice(-1);

        if (!lastEvent) {
            return acc;
        }

        const timestamp = lastEvent.getTs();
        const date = lastEvent.getDate();
        const result = {
            room: {roomId, roomName},
            timestamp,
            date,
            members,
        };

        return [...acc, result];
    },

    getOutdatedRoomsWithSender: userId => ({timestamp, members}) =>
        (timestamp < utils.getLimit()) && members.some(member => member.includes(userId)),

    getRoomsLastUpdate: (rooms, userId) =>
        rooms
            .reduce(helper.parseRoom, [])
            .filter(helper.getOutdatedRoomsWithSender(userId)),

    kickUser: client => async (user, {roomId, roomName}) => {
        try {
            await client.kick(roomId, user, 'This room is outdated');

            return translate('successUserKick', {user, roomName});
        } catch (err) {
            const msg = translate('errorUserKick', {user, roomName});
            logger.warn([msg, err].join('\n'));

            return msg;
        }
    },

    kickAllMembers: mclient => ({members, room}) =>
        Promise.all(members.map(user =>
            helper.kickUser(mclient)(user, room))),
};

module.exports = helper;
