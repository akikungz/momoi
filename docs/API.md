# Momoi API Documentation

**Version:** 1.0.0  
**Base URL:** `/api`  
**Authentication:** All endpoints require authentication unless otherwise specified

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Role-Based Access Control](#role-based-access-control)
- [API Endpoints by Role](#api-endpoints-by-role)
  - [All Authenticated Users](#all-authenticated-users)
  - [Student Role](#student-role)
  - [Instructor Role](#instructor-role)
  - [Admin Role](#admin-role)
- [Data Models](#data-models)
- [Error Responses](#error-responses)

---

## Overview

The Momoi API provides a cloud-based platform for managing course instances, user requests, and academic resources. The API is organized around REST principles with role-based access control.

## Authentication

Authentication is handled through the `/api/auth` endpoint using better-auth with support for:
- Google OAuth (Production)
- Email/Password (Development only)

All API endpoints require a valid session token. The system automatically assigns roles based on email domain:
- IT Department emails are authorized
- Instructor emails must be pre-registered in the mailing list
- Other IT department emails default to Student role

## Role-Based Access Control

The system has three primary roles:

| Role           | Description                                                           |
| -------------- | --------------------------------------------------------------------- |
| **STUDENT**    | Can view own resources, create requests, manage SSH keys              |
| **INSTRUCTOR** | Can create instances, manage own resources, review student requests   |
| **ADMIN**      | Full access to all resources, academic data, and system configuration |

---

## API Endpoints by Role

### All Authenticated Users

All authenticated users (STUDENT, INSTRUCTOR, ADMIN) have access to these endpoints:

#### User Profile

##### `GET /api/user/me`
Get current authenticated user's profile information.

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "role": "STUDENT"
}
```

---

#### SSH Key Management

##### `GET /api/user/ssh-keys`
Retrieve paginated list of SSH keys for the current user.

**Query Parameters:**
| Parameter | Type   | Default | Description    |
| --------- | ------ | ------- | -------------- |
| page      | number | 1       | Page number    |
| pageSize  | number | 10      | Items per page |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "My Laptop Key",
      "publicKey": "ssh-rsa AAAAB3...",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

##### `POST /api/user/ssh-keys`
Add a new SSH public key to the user's account.

**Request Body:**
```json
{
  "name": "My SSH Key",
  "publicKey": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ..."
}
```

**Response:**
```json
{
  "id": 1,
  "name": "My SSH Key",
  "publicKey": "ssh-rsa AAAAB3...",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

##### `DELETE /api/user/ssh-keys`
Remove one or more SSH keys from the user's account.

**Request Body:**
```json
{
  "keyIds": [1, 2, 3]
}
```

**Response:**
```json
3
```
*Returns the number of SSH keys removed*

---

#### Instance Management (Read Access)

##### `GET /api/instances`
Get all instances created by the current user.

**Query Parameters:**
| Parameter | Type   | Default | Description    |
| --------- | ------ | ------- | -------------- |
| page      | number | 1       | Page number    |
| pageSize  | number | 10      | Items per page |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Development Server",
      "status": "RUNNING",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

##### `GET /api/instances/:instanceId`
Get detailed information about a specific instance.

**Path Parameters:**
| Parameter  | Type   | Description                |
| ---------- | ------ | -------------------------- |
| instanceId | number | Unique instance identifier |

**Response:**
```json
{
  "id": 1,
  "name": "Development Server",
  "status": "RUNNING",
  "vmId": 100,
  "ipAddress": "192.168.1.100",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

##### `DELETE /api/instances/:instanceId`
Delete a specific instance by ID.

**Path Parameters:**
| Parameter  | Type   | Description                |
| ---------- | ------ | -------------------------- |
| instanceId | number | Unique instance identifier |

**Response:**
```json
{
  "message": "Instance deleted successfully"
}
```

---

#### Reverse Proxy Management

##### `POST /api/instances/:instanceId/reverse-proxies`
Create a reverse proxy configuration for an instance.

**Path Parameters:**
| Parameter  | Type   | Description                |
| ---------- | ------ | -------------------------- |
| instanceId | number | Unique instance identifier |

**Request Body:**
```json
{
  "type": "HTTP",
  "targetPort": 8080,
  "subdomain": "myapp"
}
```

**Response:**
```json
{
  "id": 1,
  "type": "HTTP",
  "targetPort": 8080,
  "subdomain": "myapp",
  "url": "https://myapp.example.com"
}
```

##### `GET /api/instances/:instanceId/reverse-proxies`
Get all reverse proxy configurations for an instance.

**Path Parameters:**
| Parameter  | Type   | Description                |
| ---------- | ------ | -------------------------- |
| instanceId | number | Unique instance identifier |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "type": "HTTP",
      "targetPort": 8080,
      "subdomain": "myapp",
      "url": "https://myapp.example.com"
    }
  ]
}
```

##### `DELETE /api/instances/:instanceId/reverse-proxies/:proxyId`
Delete a reverse proxy configuration.

**Path Parameters:**
| Parameter  | Type   | Description                |
| ---------- | ------ | -------------------------- |
| instanceId | number | Unique instance identifier |
| proxyId    | number | Unique proxy identifier    |

**Response:**
```json
{
  "message": "Reverse proxy deleted successfully"
}
```

---

### Student Role

Students have access to all [All Authenticated Users](#all-authenticated-users) endpoints, **EXCEPT**:
- ❌ `POST /api/instances/` - Students **cannot** create instances
- ❌ `GET /api/instances/:instanceId/audit-logs` - Students **cannot** view audit logs

Students have **additional access** to these request endpoints:

#### Standard Requests

##### `POST /api/requests`
Create a new instance request for instructor/admin review.

**Request Body:**
```json
{
  "courseId": 1,
  "semesterId": 1,
  "templateId": 1,
  "description": "Need a server for final project",
  "requestedResources": {
    "cpu": 2,
    "memory": 4096,
    "storage": 50
  }
}
```

**Response:**
```json
{
  "id": 1,
  "status": "PENDING",
  "courseId": 1,
  "semesterId": 1,
  "description": "Need a server for final project",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

##### `GET /api/requests`
List all requests created by the student.

**Query Parameters:**
| Parameter | Type   | Default | Description              |
| --------- | ------ | ------- | ------------------------ |
| page      | number | 1       | Page number              |
| pageSize  | number | 10      | Items per page           |
| status    | string | -       | Filter by request status |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "status": "PENDING",
      "courseId": 1,
      "description": "Need a server for final project",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

##### `PATCH /api/requests/:requestId/status`
Update request status (Students can only **cancel** their own requests).

**Path Parameters:**
| Parameter | Type   | Description               |
| --------- | ------ | ------------------------- |
| requestId | number | Unique request identifier |

**Request Body:**
```json
{
  "action": "CANCEL",
  "reason": "No longer needed"
}
```

**Response:**
```json
{
  "id": 1,
  "status": "CANCELLED",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

##### `GET /api/requests/:requestId/audit-logs`
Get audit log entries for a specific request.

**Path Parameters:**
| Parameter | Type   | Description               |
| --------- | ------ | ------------------------- |
| requestId | number | Unique request identifier |

**Query Parameters:**
| Parameter | Type   | Default | Description              |
| --------- | ------ | ------- | ------------------------ |
| page      | number | 1       | Page number              |
| pageSize  | number | 10      | Items per page (max 100) |

---

#### Extended Requests

##### `POST /api/extended-requests`
Create an extended request for changes to an existing instance.

**Request Body:**
```json
{
  "instanceId": 1,
  "requestType": "EXTEND_TIME",
  "description": "Need to extend instance for 2 more weeks",
  "requestedChanges": {
    "extensionDays": 14
  }
}
```

**Response:**
```json
{
  "id": 1,
  "status": "PENDING",
  "instanceId": 1,
  "requestType": "EXTEND_TIME",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

##### `GET /api/extended-requests`
List extended requests visible to the student.

**Query Parameters:**
| Parameter | Type   | Default | Description    |
| --------- | ------ | ------- | -------------- |
| page      | number | 1       | Page number    |
| pageSize  | number | 10      | Items per page |

##### `PATCH /api/extended-requests/:extendedRequestId/status`
Update extended request status (Students can only **cancel**).

**Path Parameters:**
| Parameter         | Type   | Description                        |
| ----------------- | ------ | ---------------------------------- |
| extendedRequestId | number | Unique extended request identifier |

**Request Body:**
```json
{
  "action": "CANCEL",
  "reason": "No longer needed"
}
```

##### `GET /api/extended-requests/:extendedRequestId/audit-logs`
Get audit log entries for a specific extended request.

**Path Parameters:**
| Parameter         | Type   | Description                        |
| ----------------- | ------ | ---------------------------------- |
| extendedRequestId | number | Unique extended request identifier |

**Query Parameters:**
| Parameter | Type   | Default | Description              |
| --------- | ------ | ------- | ------------------------ |
| page      | number | 1       | Page number              |
| pageSize  | number | 10      | Items per page (max 100) |

---

### Instructor Role

Instructors have access to all [All Authenticated Users](#all-authenticated-users) endpoints, plus additional capabilities:

#### Instance Management (Create & Advanced)

##### `POST /api/instances/`
Create a new instance (Instructors and Admins only).

**Request Body:**
```json
{
  "name": "Course Development Server",
  "courseId": 1,
  "templateId": 1,
  "resources": {
    "cpu": 4,
    "memory": 8192,
    "storage": 100
  }
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Course Development Server",
  "status": "PROVISIONING",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

##### `GET /api/instances/instructor/:instructorId`
Get all instances created by a specific instructor.

**Path Parameters:**
| Parameter    | Type   | Description                  |
| ------------ | ------ | ---------------------------- |
| instructorId | number | Unique instructor identifier |

**Query Parameters:**
| Parameter | Type   | Default | Description    |
| --------- | ------ | ------- | -------------- |
| page      | number | 1       | Page number    |
| pageSize  | number | 10      | Items per page |

##### `GET /api/instances/:instanceId/audit-logs`
Retrieve audit log entries for an instance.

**Path Parameters:**
| Parameter  | Type   | Description                |
| ---------- | ------ | -------------------------- |
| instanceId | number | Unique instance identifier |

**Query Parameters:**
| Parameter | Type   | Default | Description              |
| --------- | ------ | ------- | ------------------------ |
| page      | number | 1       | Page number              |
| pageSize  | number | 10      | Items per page (max 100) |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "action": "INSTANCE_CREATED",
      "performedBy": "John Doe",
      "timestamp": "2025-01-01T00:00:00.000Z",
      "details": {}
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

---

#### Request Management (Review)

##### `GET /api/requests`
List requests (Instructors can see requests for their courses).

**Query Parameters:**
| Parameter | Type   | Default | Description              |
| --------- | ------ | ------- | ------------------------ |
| page      | number | 1       | Page number              |
| pageSize  | number | 10      | Items per page           |
| status    | string | -       | Filter by request status |

##### `PATCH /api/requests/:requestId/status`
Approve or reject student requests for their courses.

**Request Body:**
```json
{
  "action": "APPROVE",
  "reason": "Project requirements met"
}
```
*Actions: APPROVE, REJECT*

##### `GET /api/extended-requests`
List extended requests for their courses.

##### `PATCH /api/extended-requests/:extendedRequestId/status`
Approve or reject extended requests.

**Request Body:**
```json
{
  "action": "APPROVE",
  "reason": "Valid extension request"
}
```

---

### Admin Role

Admins have **full access** to all endpoints, including:

#### All Academic Endpoints (Admin Only)

All academic endpoints require **ADMIN** role and are prefixed with `/api/academic`.

##### Instructor Mailing List

###### `GET /api/academic/mailing-list`
Get the instructor mailing list for registration purposes.

**Query Parameters:**
| Parameter | Type   | Default | Description    |
| --------- | ------ | ------- | -------------- |
| page      | number | 1       | Page number    |
| pageSize  | number | 10      | Items per page |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "email": "instructor@example.com",
      "name": "Dr. Jane Smith",
      "havePlatformId": true,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

###### `POST /api/academic/mailing-list`
Add a new instructor email to the mailing list.

**Request Body:**
```json
{
  "email": "newinstructor@example.com",
  "name": "Dr. John Doe"
}
```

**Response:**
```json
{
  "id": 2,
  "email": "newinstructor@example.com",
  "name": "Dr. John Doe",
  "havePlatformId": false,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

###### `DELETE /api/academic/mailing-list/:mailingId`
Remove an instructor from the mailing list.

**Path Parameters:**
| Parameter | Type   | Description                          |
| --------- | ------ | ------------------------------------ |
| mailingId | number | Unique mailing list entry identifier |

**Response:**
```json
{
  "message": "Instructor removed from mailing list"
}
```

---

##### Instructors Management

###### `GET /api/academic/instructors`
Get paginated list of all instructors.

**Query Parameters:**
| Parameter | Type   | Default | Description    |
| --------- | ------ | ------- | -------------- |
| page      | number | 1       | Page number    |
| pageSize  | number | 10      | Items per page |

###### `GET /api/academic/instructors/:instructorId`
Get detailed information about a specific instructor.

**Path Parameters:**
| Parameter    | Type   | Description                  |
| ------------ | ------ | ---------------------------- |
| instructorId | number | Unique instructor identifier |

###### `PATCH /api/academic/instructors/:instructorId`
Update instructor information.

**Path Parameters:**
| Parameter    | Type   | Description                  |
| ------------ | ------ | ---------------------------- |
| instructorId | number | Unique instructor identifier |

**Request Body:**
```json
{
  "name": "Dr. Jane Smith",
  "email": "jane.smith@example.com",
  "department": "Computer Science"
}
```

---

##### Course Management

###### `GET /api/academic/courses`
Get paginated list of all courses.

**Query Parameters:**
| Parameter | Type   | Default | Description    |
| --------- | ------ | ------- | -------------- |
| page      | number | 1       | Page number    |
| pageSize  | number | 10      | Items per page |

###### `GET /api/academic/courses/:courseId`
Get detailed information about a specific course.

**Path Parameters:**
| Parameter | Type   | Description              |
| --------- | ------ | ------------------------ |
| courseId  | string | Unique course identifier |

###### `POST /api/academic/courses`
Create a new course.

**Request Body:**
```json
{
  "code": "CS101",
  "name": "Introduction to Computer Science",
  "description": "Fundamental concepts of programming",
  "credits": 3
}
```

###### `PATCH /api/academic/courses/:courseId`
Update course information.

**Path Parameters:**
| Parameter | Type   | Description              |
| --------- | ------ | ------------------------ |
| courseId  | string | Unique course identifier |

**Request Body:**
```json
{
  "name": "Advanced Computer Science",
  "description": "Updated description",
  "credits": 4
}
```

###### `PATCH /api/academic/courses/:courseId/instructors`
Assign or update instructors for a course.

**Path Parameters:**
| Parameter | Type   | Description              |
| --------- | ------ | ------------------------ |
| courseId  | string | Unique course identifier |

**Request Body:**
```json
{
  "instructorIds": [1, 2, 3]
}
```

###### `PATCH /api/academic/courses/:courseId/semesters`
Assign or update semesters for a course.

**Path Parameters:**
| Parameter | Type   | Description              |
| --------- | ------ | ------------------------ |
| courseId  | string | Unique course identifier |

**Request Body:**
```json
{
  "semesterIds": [1, 2]
}
```

---

##### Semester Management

###### `GET /api/academic/semesters`
Get paginated list of all semesters.

**Query Parameters:**
| Parameter | Type   | Default | Description    |
| --------- | ------ | ------- | -------------- |
| page      | number | 1       | Page number    |
| pageSize  | number | 10      | Items per page |

###### `GET /api/academic/semesters/:semesterId`
Get detailed information about a specific semester.

**Path Parameters:**
| Parameter  | Type   | Description                |
| ---------- | ------ | -------------------------- |
| semesterId | number | Unique semester identifier |

###### `POST /api/academic/semesters`
Create a new semester.

**Request Body:**
```json
{
  "year": 2025,
  "term": "SPRING",
  "startDate": "2025-01-15",
  "endDate": "2025-05-30"
}
```

###### `PATCH /api/academic/semesters/:semesterId`
Update semester information.

**Path Parameters:**
| Parameter  | Type   | Description                |
| ---------- | ------ | -------------------------- |
| semesterId | number | Unique semester identifier |

**Request Body:**
```json
{
  "startDate": "2025-01-20",
  "endDate": "2025-06-05"
}
```

###### `PATCH /api/academic/semesters/:semesterId/courses`
Assign or update courses for a semester.

**Path Parameters:**
| Parameter  | Type   | Description                |
| ---------- | ------ | -------------------------- |
| semesterId | number | Unique semester identifier |

**Request Body:**
```json
{
  "courseIds": ["CS101", "CS102", "CS201"]
}
```

###### `DELETE /api/academic/semesters/:semesterId`
Delete a semester from the system.

**Path Parameters:**
| Parameter  | Type   | Description                |
| ---------- | ------ | -------------------------- |
| semesterId | number | Unique semester identifier |

**Response:**
```json
{
  "message": "Semester deleted successfully"
}
```

---

#### Instance Management (Admin)

##### `GET /api/instances/admin`
Get all instances in the system (admin view).

**Query Parameters:**
| Parameter | Type   | Default | Description    |
| --------- | ------ | ------- | -------------- |
| page      | number | 1       | Page number    |
| pageSize  | number | 10      | Items per page |

##### `PATCH /api/instances/:instanceId/promote`
Promote an instance to long-term/production status (Admin only).

**Path Parameters:**
| Parameter  | Type   | Description                |
| ---------- | ------ | -------------------------- |
| instanceId | number | Unique instance identifier |

**Response:**
```json
{
  "id": 1,
  "status": "PROMOTED",
  "promotedAt": "2025-01-01T00:00:00.000Z"
}
```

---

#### Request Management (Admin)

##### `GET /api/requests`
List all requests in the system.

**Query Parameters:**
| Parameter | Type   | Default | Description      |
| --------- | ------ | ------- | ---------------- |
| page      | number | 1       | Page number      |
| pageSize  | number | 10      | Items per page   |
| status    | string | -       | Filter by status |

##### `PATCH /api/requests/:requestId/status`
Approve or reject any request (full admin control).

**Request Body:**
```json
{
  "action": "APPROVE",
  "reason": "Administrative approval"
}
```
*Actions: APPROVE, REJECT*

##### `GET /api/extended-requests`
List all extended requests in the system.

##### `PATCH /api/extended-requests/:extendedRequestId/status`
Approve or reject any extended request.

---

## Data Models

### User
```typescript
{
  id: number;
  email: string;
  name: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}
```

### SSH Key
```typescript
{
  id: number;
  name: string;
  publicKey: string;
  userId: number;
  createdAt: string;
}
```

### Instance
```typescript
{
  id: number;
  name: string;
  status: "PROVISIONING" | "RUNNING" | "STOPPED" | "TERMINATED";
  vmId: number;
  ipAddress: string;
  courseId: string;
  instructorId: number;
  createdAt: string;
  updatedAt: string;
}
```

### Request
```typescript
{
  id: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  studentId: number;
  courseId: string;
  semesterId: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}
```

### Extended Request
```typescript
{
  id: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  instanceId: number;
  requestType: "EXTEND_TIME" | "UPGRADE_RESOURCES" | "OTHER";
  description: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## Error Responses

### Standard Error Format
```json
{
  "status": 400,
  "message": "Detailed error message"
}
```

### Common HTTP Status Codes

| Code | Description                            |
| ---- | -------------------------------------- |
| 200  | Success                                |
| 400  | Bad Request - Invalid input            |
| 401  | Unauthorized - Authentication required |
| 403  | Forbidden - Insufficient permissions   |
| 404  | Not Found - Resource doesn't exist     |
| 500  | Internal Server Error                  |

### Role-Based Error Examples

#### Student trying to create an instance:
```json
{
  "status": 403,
  "message": "Forbidden: Students cannot create instances"
}
```

#### Non-admin accessing academic endpoints:
```json
{
  "status": 403,
  "message": "Forbidden: Admins only"
}
```

#### Student trying to view audit logs:
```json
{
  "status": 403,
  "message": "Forbidden: Students cannot view instance audit logs"
}
```

---

## Quick Reference: Role Access Matrix

| Endpoint                                  | Student    | Instructor         | Admin   |
| ----------------------------------------- | ---------- | ------------------ | ------- |
| `GET /api/user/me`                        | ✅          | ✅                  | ✅       |
| `GET /api/user/ssh-keys`                  | ✅          | ✅                  | ✅       |
| `POST /api/user/ssh-keys`                 | ✅          | ✅                  | ✅       |
| `DELETE /api/user/ssh-keys`               | ✅          | ✅                  | ✅       |
| `POST /api/instances`                     | ❌          | ✅                  | ✅       |
| `GET /api/instances`                      | ✅          | ✅                  | ✅       |
| `GET /api/instances/admin`                | ❌          | ❌                  | ✅       |
| `GET /api/instances/:id`                  | ✅          | ✅                  | ✅       |
| `DELETE /api/instances/:id`               | ✅          | ✅                  | ✅       |
| `GET /api/instances/:id/audit-logs`       | ❌          | ✅                  | ✅       |
| `PATCH /api/instances/:id/promote`        | ❌          | ❌                  | ✅       |
| `POST /api/requests`                      | ✅          | ❌                  | ❌       |
| `GET /api/requests`                       | ✅ (own)    | ✅ (course)         | ✅ (all) |
| `PATCH /api/requests/:id/status`          | ✅ (cancel) | ✅ (approve/reject) | ✅ (all) |
| `POST /api/extended-requests`             | ✅          | ❌                  | ❌       |
| `GET /api/extended-requests`              | ✅ (own)    | ✅ (course)         | ✅ (all) |
| `PATCH /api/extended-requests/:id/status` | ✅ (cancel) | ✅ (approve/reject) | ✅ (all) |
| `/api/academic/*`                         | ❌          | ❌                  | ✅       |

---

**Last Updated:** December 26, 2025  
