# Pokémon Explorer — AWS deployment

Stack: static site on **S3**, **AWS Lambda** (Function URL) for collection/preferences, **DynamoDB** for storage, **PokeAPI** for Pokémon data (called directly from the browser).

## 1. DynamoDB
Create a table `PokemonExplorer`, partition key `userId` (String), sort key `sk` (String), on-demand capacity.

## 2. Lambda
1. Create a function (Node.js 20.x), paste `lambda/index.mjs`, rename the file to `index.mjs`, and set the environment variable `TABLE_NAME=PokemonExplorer`.
2. Give its execution role `dynamodb:Query`, `PutItem`, `DeleteItem` on the table.
3. Configuration → Function URL → Auth type `NONE`, enable CORS: allowed origin = your S3 website URL (use `*` while testing), allowed methods `POST`, allowed headers `content-type`.
4. Copy the Function URL into `API_URL` at the top of `web/app.js`.

## 3. S3 hosting
1. Create a bucket, turn off "Block all public access", enable Static website hosting (index document `index.html`).
2. Upload `index.html`, `styles.css`, `app.js`.
3. Add a bucket policy allowing `s3:GetObject` on `arn:aws:s3:::YOUR-BUCKET/*` for `Principal: "*"`.
4. Open the bucket website endpoint.

## Notes
- Users are anonymous: a random ID is saved in the browser's localStorage and used as the DynamoDB partition key. Add Cognito if you need real accounts.
- With `API_URL` empty, the app runs fully in the browser (collection saved to localStorage), useful for local testing.
- Game availability uses PokeAPI encounter data, so Pokémon obtained by gift, evolution, or breeding show as "not obtainable in the wild".
