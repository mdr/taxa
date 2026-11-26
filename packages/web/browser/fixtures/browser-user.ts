import type { CreateTaskRequest } from "@taxa/shared/tasks/task-requests"
import type { Task } from "@taxa/shared/tasks/task"
import { TestUser } from "../../../server/src/test-support/test-user.ts"

/**
 * Matt, setting up tasks for a browser test: one added in a domain is filed
 * there, listed in it; one added without saying which goes in his only domain
 * as the app would put it, in the Inbox unless it says when. Say `inbox` to
 * have it otherwise.
 */
export class BrowserUser extends TestUser {
  static of(user: TestUser): BrowserUser {
    return new BrowserUser(user.httpUrl, user.name, user.secret)
  }

  override addTask(title: string, fields: Omit<CreateTaskRequest, "title"> = {}): Promise<Task> {
    return super.addTask(title, { ...fields, inbox: fields.inbox ?? (fields.domain === undefined ? undefined : false) })
  }
}
