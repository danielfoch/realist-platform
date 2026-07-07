import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";

interface InboxNotification {
  id: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

interface InboxResponse {
  notifications: InboxNotification[];
  unreadCount: number;
}

/**
 * Nav bell over the notification_queue inbox (GET /api/notifications).
 * Rendered in Navigation only when authenticated; polls every 60s and on
 * window focus so the badge stays roughly live without hammering the API.
 */
export function NotificationBell() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data } = useQuery<InboxResponse>({
    queryKey: ["/api/notifications"],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: async (ids?: string[]) => {
      await apiRequest("POST", "/api/notifications/read", ids ? { ids } : {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const openNotification = (notification: InboxNotification) => {
    if (!notification.readAt) markRead.mutate([notification.id]);
    if (!notification.link) return;
    if (notification.link.startsWith("/") || notification.link.startsWith("?")) {
      navigate(notification.link);
    } else {
      window.open(notification.link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          data-testid="button-notification-bell"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium leading-4 text-center"
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {unreadCount > 0 && (
          // A DropdownMenuItem (not a Button) so Radix's roving focus reaches
          // it by keyboard; preventDefault keeps the menu open while marking.
          <DropdownMenuItem
            className="text-xs text-muted-foreground gap-1"
            disabled={markRead.isPending}
            onSelect={(event) => {
              event.preventDefault();
              markRead.mutate(undefined);
            }}
            data-testid="button-mark-all-read"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground" data-testid="text-notifications-empty">
            No notifications yet
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="cursor-pointer py-2.5 items-start gap-2"
                onSelect={() => openNotification(notification)}
                data-testid={`item-notification-${notification.id}`}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "bg-transparent" : "bg-primary"}`}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${notification.readAt ? "text-muted-foreground" : "font-medium"}`}>
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                      {notification.body}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
