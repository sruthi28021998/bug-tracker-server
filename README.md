# Bug Tracker – Server

REST API + Socket.io for the Bug Tracker. Node.js, Express, MongoDB (Mongoose), JWT, Multer.

## Setup
```
npm install
cp .env.example .env   # fill in values
npm run dev
```

## Environment variables
| Name | Description |
|---|---|
| PORT | Server port (default 5000) |
| MONGO_URI | MongoDB Atlas connection string |
| JWT_SECRET | Secret used to sign tokens |
| CLIENT_URL | Frontend URL for CORS (no trailing slash) |

## API
Protected routes need the header `Authorization: Bearer <token>`.

| Method | Endpoint | Notes |
|---|---|---|
| POST | /api/auth/register | name, email, password |
| POST | /api/auth/login | email, password |
| GET / POST | /api/projects | List my projects / create |
| GET / PUT / DELETE | /api/projects/:id | PUT needs manager+, DELETE needs owner |
| POST | /api/projects/:id/members | email, role (manager, developer, viewer) |
| PUT / DELETE | /api/projects/:id/members/:userId | Change role / remove |
| GET | /api/tickets | ?projectId (required), status, priority, assignee, search, sort |
| POST | /api/tickets | Create ticket |
| PUT / DELETE | /api/tickets/:id | Update (also used for assign) / delete |
| POST | /api/tickets/:id/attachments | form-data, key `files`, images only, max 5 MB |
| DELETE | /api/tickets/:id/attachments/:fileId | Remove screenshot |

## Roles
| Role | Permissions |
|---|---|
| admin (owner) | Everything |
| manager | Edit project, manage members, create/edit/delete any ticket |
| developer | Create/edit tickets, delete own tickets |
| viewer | Read only |