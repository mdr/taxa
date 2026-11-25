import type { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "../../api/query-keys.ts"
import type { CommentCache } from "../../undo/undo-service.ts"

/** Comments as TanStack Query keeps them, by task: one changed elsewhere is shown by asking again. */
export const queryCommentCache = (queryClient: QueryClient): CommentCache => ({
  show: (comment) => queryClient.invalidateQueries({ queryKey: queryKeys.comments(comment.taskId) })
})
