export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  defaultCurrency: string;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    defaultCurrency: user.defaultCurrency
  };
}
