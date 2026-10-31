import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Send } from 'lucide-react';
import { apiPost } from '@/api/client';
import { useFetch } from '@/hooks/useFetch';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Avatar } from '@/layouts/Topbar';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/input';
import { notifyError, notifySuccess } from '@/components/ui/toast';

// §8.19 activity thread: comments with the composer at the bottom, interleaved with system events (status changes,
// checks, ledger entries) when the page can supply them. A combined activity endpoint is agreed (§15-5); until it
// exists, pages pass the events they can derive from the record.

interface Comment {
  commentId: string;
  commentText: string;
  createdByUserId: string;
  createdByUserName: string | null;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  at: string;
  icon: LucideIcon;
  text: ReactNode;
  by?: string | null;
  tone?: string;
}

interface ActivityThreadProps {
  // Comments endpoint (GET list, POST { text }). Omit for an events-only timeline.
  commentsPath?: string;
  canComment?: boolean;
  events?: ActivityEvent[];
  className?: string;
  maxLength?: number;
}

type Entry = { kind: 'comment'; at: string; comment: Comment } | { kind: 'event'; at: string; event: ActivityEvent };

export default function ActivityThread({ commentsPath, canComment = false, events = [], className, maxLength = 2000 }: ActivityThreadProps) {
  const { data: comments, loading, refetch } = useFetch<Comment[]>(commentsPath ?? null);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const entries: Entry[] = [
    ...(comments ?? []).map((c) => ({ kind: 'comment' as const, at: c.createdAt, comment: c })),
    ...events.map((e) => ({ kind: 'event' as const, at: e.at, event: e })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const post = async () => {
    if (!commentsPath || !text.trim()) return;
    setPosting(true);
    try {
      await apiPost(commentsPath, { text: text.trim() });
      setText('');
      notifySuccess('Comment posted');
      await refetch();
    } catch (err) {
      notifyError(err, "The comment wasn't posted");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !comments ? (
          <div className="space-y-3 p-1">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : entries.length === 0 ? (
          <EmptyState title="No activity yet" description={canComment ? 'Comments and changes to this record show up here.' : undefined} className="py-8" />
        ) : (
          <ol className="space-y-4">
            {entries.map((entry) => {
              if (entry.kind === 'event') {
                const Icon = entry.event.icon;
                return (
                  <li key={`e-${entry.event.id}`} className="flex items-start gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon aria-hidden className={cn('size-3.5 text-muted-foreground', entry.event.tone)} />
                    </span>
                    <p className="min-w-0 flex-1 pt-0.5 text-muted-foreground">
                      <span className="text-foreground">{entry.event.text}</span>
                      {entry.event.by && <> · {entry.event.by}</>}
                      {' · '}
                      <time dateTime={entry.at} title={formatDateTime(entry.at)}>{formatRelative(entry.at)}</time>
                    </p>
                  </li>
                );
              }
              const c = entry.comment;
              return (
                <li key={`c-${c.commentId}`} className="flex items-start gap-3">
                  <Avatar name={c.createdByUserName} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-medium text-foreground">{c.createdByUserName || 'Unknown user'}</span>
                      <time dateTime={c.createdAt} title={formatDateTime(c.createdAt)} className="text-caption text-muted-foreground">
                        {formatRelative(c.createdAt)}
                      </time>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{c.commentText}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {commentsPath && canComment && (
        <form
          className="mt-4 shrink-0 space-y-2 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void post();
          }}
        >
          <label htmlFor="activity-composer" className="sr-only">Add a comment</label>
          <Textarea
            id="activity-composer"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            maxLength={maxLength}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void post();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-muted-foreground">Ctrl/⌘ Enter to post</span>
            <Button type="submit" size="sm" icon={Send} loading={posting} loadingText="Posting…" disabled={!text.trim()}>Post</Button>
          </div>
        </form>
      )}
    </div>
  );
}
