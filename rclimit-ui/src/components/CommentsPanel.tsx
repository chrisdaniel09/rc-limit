import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { apiPost } from '../api/client';

interface Comment {
  commentId: string;
  commentText: string;
  createdByUserId: string;
  createdByUserName: string | null;
  createdAt: string;
}

interface CommentsPanelProps {
  basePath: string;
  canAdd: boolean;
}

export default function CommentsPanel({ basePath, canAdd }: CommentsPanelProps) {
  const { data: comments = [], loading: commentsLoading, refetch } = useFetch<Comment[]>(basePath);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      alert('Please enter a comment');
      return;
    }

    setSubmitting(true);
    try {
      await apiPost(basePath, { text: commentText.trim() });
      setCommentText('');
      refetch();
    } catch (err) {
      console.error('Failed to add comment:', err);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Input Section */}
      {canAdd && (
        <div className="border-b border-gray-200 p-4 flex-shrink-0">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add call notes..."
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">{commentText.length}/2000</span>
            <button
              onClick={handleAddComment}
              disabled={!commentText.trim() || submitting}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Adding...' : 'Add Comment'}
            </button>
          </div>
        </div>
      )}

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {commentsLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">Loading comments...</p>
          </div>
        ) : !comments || comments.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">No comments yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => {
              const dt = formatDateTime(comment.createdAt);
              return (
                <div key={comment.commentId} className="border-l-2 border-indigo-300 pl-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {comment.createdByUserName || 'Unknown User'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {dt.date} at {dt.time}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {comment.commentText}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
