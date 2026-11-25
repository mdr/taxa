/** A key pressed in a comment's field, as far as sending it goes. */
export interface CommentKey {
  key: string
  shiftKey: boolean
  /** Mid-way through composing a character with an input method, whose Enter picks it. */
  isComposing: boolean
}

/** Whether a key sends the comment: Enter does, as in a chat; Shift+Enter starts a new line. */
export const sendsComment = ({ key, shiftKey, isComposing }: CommentKey): boolean =>
  key === "Enter" && !shiftKey && !isComposing
