export interface Tag {
    id: string;
    name: string;
}

export interface PersonTag extends Tag {
    type: 'Person';
}

export interface LocationTag extends Tag {
    type: 'Location';
}

export interface EventTag extends Tag {
    type: 'Event';
}

export interface TimeTag extends Tag {
    type: 'Time';
}