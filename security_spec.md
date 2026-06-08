# Security Specification - Snap AI

## 1. Data Invariants
- **User Role integrity**: Users can only write their own user document, but they CANNOT self-assign the `role` field. It must default to `client`. Only an existing `admin` can escalate roles to `staff` or `admin`.
- **Project Ownership**: Only authenticated `staff` or `admin` accounts can create projects.
- **Photo Upload Verification**: Photos must have a valid `projectId` linked to an existing project document. Photos can only be uploaded and managed by `staff` or `admin` users.

## 2. The "Dirty Dozen" Threat Vectors (Rejected Payloads)
1. **Unauthenticated User Profile Creation**: Creating `/users/attacker` without being signed in.
2. **User Self-Escalation**: Registered client trying to change their own role to `admin` or `staff`.
3. **Foreign Profile Modification**: Registered user `A` attempting to modify profile information of user `B`.
4. **Anomalous ID Injection**: Writing a project with an abnormally large ID or malicious characters (e.g., project ID is 2MB long).
5. **Timestamp Decoupling**: Creating a photo with a future client-generated `createdAt` timestamp instead of server timestamp `request.time`.
6. **Project Spoil / Deletion by Client**: Client profile trying to delete a verified event project.
7. **Client Photo Upload**: Client role trying to write photos directly into `/photos/{id}`.
8. **Client Photo Deletion**: Client role attempting to delete standard photo entries.
9. **Unauthenticated Project Read (Private Data)**: Pulling full raw projects without proper authentication if restricted, but public projects are allowed for the slider.
10. **Shadow Project Update (Privilege Exploitation)**: Modifying standard immutable fields of a project like `creatorId`.
11. **Orphaned Photo Write**: Writing a photo with a `projectId` that doesn't correspond to any actual project in Firestore.
12. **PII Data Leak**: Attempting to grab list/emails of all system users by performing blanket queries.

## 3. Database Rules Configuration
Security rules mapped strictly to ABAC patterns:
- `/users/{userId}`: Reads allowed for owner and admins. Updates only allowed for owners (without modifying `role`) or admins.
- `/projects/{projectId}`: Reads allowed for anyone (public slider). Writes allowed only for staff or admin.
- `/photos/{photoId}`: Reads allowed for signed-in users. Writes allowed only for staff or admin.
