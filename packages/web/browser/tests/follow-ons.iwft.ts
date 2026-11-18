import { Horizon } from "@taxa/shared/tasks/task"
import { test } from "../fixtures/taxa-fixture.ts"

test("finishing a task, adding what follows on from it, and following the trail both ways", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Back up the floppy disks", { domain: "H" })
  await taxa.matt.addTask("Sort the loft boxes", { domain: "H" })
  const home = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openDomain("Home"))

  // Ticked off, it offers to add what comes next: in the same domain, for when you choose.
  await home.complete("Back up the floppy disks")
  const dialog = await home.addFollowOnFromUndo()
  await dialog.expectFrom("H-1 Back up the floppy disks")
  await dialog.expectAccessible()
  await dialog.add("Dispose of the disks", "Someday")
  await taxa.expectTask("H-3", { title: "Dispose of the disks", horizon: Horizon.SOMEDAY })

  // Its page says where it came from; the earlier one's says what it led to.
  const someday = await home.sidebar.openList("Someday")
  const dispose = await someday.openTask("Dispose of the disks")
  await dispose.followOns.expectFollowsOn("H-1 Back up the floppy disks")
  await dispose.followOns.expectLedTo([])
  await dispose.expectAccessible()
  await dispose.followOns.openFollowsOn()
  await dispose.expectTitle("Back up the floppy disks")
  await dispose.followOns.expectLedTo(["H-3 Dispose of the disks"])
  await (await dispose.followOns.addFollowOnWithKey()).add("Upload the photos")
  await dispose.followOns.expectLedTo(["H-3 Dispose of the disks", "H-4 Upload the photos"])

  // Following on from itself, or from what followed on from it, would be a loop.
  await dispose.followOns.setFollowsOn("dispose", "Dispose of the disks")
  await dispose.followOns.expectProblem("can't follow on from itself, or from one that follows on from it")
  await dispose.followOns.expectFollowsOn("")
})

test("adding a follow-on from any task's menu, and linking or unlinking tasks afterwards", async ({ taxa }) => {
  await taxa.matt.addDomain("Home", "H")
  await taxa.matt.addTask("Back up the floppy disks", { domain: "H" })
  await taxa.matt.addTask("Sort the loft boxes", { domain: "H" })
  const home = await (await taxa.openTab("Matt")).openInbox().then((inbox) => inbox.sidebar.openDomain("Home"))

  await (await (await home.openMenu("Sort the loft boxes")).addFollowOn()).add("Label the boxes")
  await home.expectTasks(["H-1 Back up the floppy disks", "H-2 Sort the loft boxes", "H-3 Label the boxes"])
  const label = await home.openTask("Label the boxes")
  await label.followOns.expectFollowsOn("H-2 Sort the loft boxes")

  await label.followOns.unlink()
  await label.followOns.expectFollowsOn("")
  await label.followOns.setFollowsOn("floppy", "Back up the floppy disks")
  await label.followOns.expectFollowsOn("H-1 Back up the floppy disks")
})
