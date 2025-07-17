import { Tag } from './tag.types';

export interface Image {
    id: string;
    filename: string;
    s3_url: string;
    tags: Tag[];
}