export type MessageSegment =
	| { type: 'text'; value: string }
	| { type: 'vehicle_ref'; vin: string; label: string }
	| { type: 'appointment_ref'; id: string; label: string };

export type MessageContent = MessageSegment[];

export type Message = {
	id: string;
	userId: string;
	userName: string; // joined from users.name at query time
	content: MessageContent;
	createdAt: string; // ISO timestamp
};
