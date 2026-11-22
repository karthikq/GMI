// Stored as a user's `avatar` when they remove their photo, so the Google
// photo isn't used either and the default avatar shows instead.
export const NO_PHOTO = "none";

const MALE_AVATAR =
  "https://res.cloudinary.com/oncuu6pg/image/upload/v1795359812/Minimal_Male_Profile_Avatar.png";
const FEMALE_AVATAR =
  "https://res.cloudinary.com/oncuu6pg/image/upload/v1795359955/Wavy-Haired_Woman_Avatar.png";

export function defaultAvatar(gender?: string) {
  return gender === "male" ? MALE_AVATAR : FEMALE_AVATAR;
}

export function profileImage(user: { avatar?: string; picture?: string; gender?: string }) {
  if (user.avatar === NO_PHOTO) return defaultAvatar(user.gender);
  return user.avatar || user.picture || defaultAvatar(user.gender);
}
