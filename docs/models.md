# Upload and view images

### Image
```
{
    id: UUID;
    filename: string;
    s3_url: string;
    tags: Tag[];
}
```

### Tag
```
{
    id: UUID;
    name: string;
    type: 'Person' | 'Location' | 'Event' | 'Time';
}
```
