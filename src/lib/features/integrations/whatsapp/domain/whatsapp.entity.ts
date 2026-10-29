import {
	contactsMatch,
	type ChannelSessionInfo,
	type ChannelSessionStatus,
	type ChatMessage,
	type ChatMessageKey,
	type RealtimeChatEvent
} from '#lib/features/messaging/domain/chat.entity';

export type WhatsAppSessionStatus = ChannelSessionStatus;
export type WhatsAppMessageKey = ChatMessageKey;
export type WhatsAppMessage = ChatMessage;
export type WhatsAppSessionInfo = Omit<ChannelSessionInfo, 'channel'> & {
	channel?: 'whatsapp' | (string & {});
};
export type RealtimeEvent = RealtimeChatEvent;

export const phonesMatch = contactsMatch;
export { contactsMatch };
