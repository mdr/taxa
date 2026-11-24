import { EventEmitter } from "node:events"
import { describe, expect, it } from "vite-plus/test"
import { exitQuietlyOnBrokenPipe } from "./broken-pipe.ts"

const errorWithCode = (code: string): NodeJS.ErrnoException => Object.assign(new Error(code), { code })

describe("exitQuietlyOnBrokenPipe", () => {
  it("exits successfully when the reader goes away", () => {
    const output = new EventEmitter()
    const exits: number[] = []
    exitQuietlyOnBrokenPipe(output, (code) => exits.push(code))
    output.emit("error", errorWithCode("EPIPE"))
    expect(exits).toEqual([0])
  })

  it("leaves any other error to crash", () => {
    const output = new EventEmitter()
    const exits: number[] = []
    exitQuietlyOnBrokenPipe(output, (code) => exits.push(code))
    expect(() => output.emit("error", errorWithCode("EIO"))).toThrow("EIO")
    expect(exits).toEqual([])
  })
})
