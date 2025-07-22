# Grammysnaps API Routes

### Health Check

### `GET /health`

<details open>
  <summary>Response</summary>
  <h4>200 OK</h4>

```json
{
  "status": "ok",
  "database": "connected"
}
```

</details>
<br>

## Image Routes

### Get All Images

### `GET /image`

<details open>
  <summary>Response</summary>
  <h4>200 OK</h4>

```json
{
  "images": [
    {
      "id": 1,
      "filename": "test.file",
      "created_at": "2025-07-17T04:42:39.599Z"
    },
    {
      "id": 2,
      "filename": "another.file",
      "created_at": "2025-07-17T04:43:09.094Z"
    }
  ]
}
```

</details>
<br>
<br>

### Upload Image

### `POST /image`

<details open>
  <summary>Request Body</summary>

```ts
{
  filename: string;
}
```

</details>

<details open>
  <summary>Response</summary>
  <h4>200 OK</h4>

```json
{
  "file": {
    "id": 2,
    "filename": "duplicate-test.file",
    "created_at": "2025-07-17T04:43:09.094Z"
  }
}
```

</details>
<br>
<br>
