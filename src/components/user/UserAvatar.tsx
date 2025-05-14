import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user: Pick<User, 'username' | 'avatarUrl'> | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  const getInitials = (name?: string) => {
    if (!name) return '??';
    const names = name.split(' ');
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    return (names[0][0] + (names[names.length - 1][0] || '')).toUpperCase();
  };

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-lg',
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={user?.avatarUrl || undefined} alt={user?.username || 'User avatar'} data-ai-hint="profile avatar" />
      <AvatarFallback className={cn(sizeClasses[size])}>
        {getInitials(user?.username)}
      </AvatarFallback>
    </Avatar>
  );
}