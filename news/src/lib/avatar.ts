// Stored as a user's `avatar` when they remove their photo, so the Google
// photo isn't used either and the default avatar shows instead.
export const NO_PHOTO = "none";

// Inline SVG shown when a remote avatar URL fails to load.
export const EMPTY_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='%23e4e2dc'/%3E%3Ccircle cx='48' cy='37' r='15' fill='%239a968e'/%3E%3Cpath d='M18 90c3-17 15-25 30-25s27 8 30 25z' fill='%239a968e'/%3E%3C/svg%3E";

const MALE_AVATAR =
  "https://res.cloudinary.com/oncuu6pg/image/upload/v1795359812/Minimal_Male_Profile_Avatar.png";
const FEMALE_AVATAR =
  "https://res.cloudinary.com/oncuu6pg/image/upload/v1795359955/Wavy-Haired_Woman_Avatar.png";

export function defaultAvatar(gender?: string) {
  return gender === "female" ? FEMALE_AVATAR : MALE_AVATAR;
}

export function profileImage(user: { avatar?: string; picture?: string; gender?: string }) {
  if (user.avatar === NO_PHOTO) return defaultAvatar(user.gender);
  return user.avatar || user.picture || defaultAvatar(user.gender);
}
