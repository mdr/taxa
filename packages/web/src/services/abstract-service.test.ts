import { describe, expect, it, vi } from "vite-plus/test"
import { AbstractService } from "./abstract-service.ts"

class Counter extends AbstractService<{ count: number; label: string }> {
  constructor() {
    super({ count: 0, label: "none" })
  }

  readonly addTwice = (): void => {
    this.updateState((state) => ({ ...state, count: state.count + 1 }))
    this.updateState((state) => ({ ...state, count: state.count + 1 }))
    this.setState({ label: "twice" })
  }
}

const settled = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve))

describe("AbstractService", () => {
  it("shows each write in its state at once", () => {
    const counter = new Counter()
    counter.addTwice()
    expect(counter.state).toEqual({ count: 2, label: "twice" })
  })

  it("tells its listeners once about writes made together", async () => {
    const counter = new Counter()
    const listener = vi.fn()
    counter.subscribe(listener)
    counter.addTwice()
    expect(listener).not.toHaveBeenCalled()
    await settled()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("stops telling a listener that unsubscribed", async () => {
    const counter = new Counter()
    const listener = vi.fn()
    const unsubscribe = counter.subscribe(listener)
    unsubscribe()
    counter.addTwice()
    await settled()
    expect(listener).not.toHaveBeenCalled()
  })
})
