export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  avatarStyle: string | null;
  avatarSeed: string | null;
  defaultCurrency: string;
  createdAt?: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    avatarStyle: user.avatarStyle,
    avatarSeed: user.avatarSeed,
    defaultCurrency: user.defaultCurrency,
    createdAt: user.createdAt
  };
}
