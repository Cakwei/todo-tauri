import { hashPassword } from 'better-auth/crypto'
import { prisma } from "../src/db";
import { Priority, TodoStatus } from "../src/generated/prisma/enums";


async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Clean up existing data in correct relational dependency order
  await prisma.activityLog.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.todoTag.deleteMany();
  await prisma.todo.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.project.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("🧹 Cleaned existing database records.");

  // Hash password for all users
  const hashedPassword = await hashPassword("123456789");

  // 2. Seed Users
  const userPrimary = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name: "Jane Doe",
      email: "jane@dev.io",
      emailVerified: true,
      image: "https://avatar.vercel.sh/jane",
    },
  });

  const userSecondary = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name: "Alex Chen",
      email: "alex@dev.io",
      emailVerified: true,
      image: "https://avatar.vercel.sh/alex",
    },
  });

  console.log("👤 Created Users");

  // 3. Seed Accounts (BetterAuth Credentials)
  await prisma.account.createMany({
    data: [
      {
        id: crypto.randomUUID(),
        issuer: "local:credential",
        accountId: userPrimary.id,
        providerId: "credential",
        userId: userPrimary.id,
        password: hashedPassword,
      },
      {
        id: crypto.randomUUID(),
        issuer: "local:credential",
        accountId: userSecondary.id,
        providerId: "credential",
        userId: userSecondary.id,
        password: hashedPassword,
      },
    ],
  });

  console.log("🔐 Created Accounts");

  // 6. Seed Projects
  const projectWork = await prisma.project.create({
    data: {
      name: "Work & Engineering",
      description: "Sprint tasks and system architecture backlog",
      color: "#3b82f6",
      icon: "briefcase",
      userId: userPrimary.id,
    },
  });

  const projectPersonal = await prisma.project.create({
    data: {
      name: "Personal Growth",
      description: "Fitness, reading, and skill improvement",
      color: "#10b981",
      icon: "user",
      userId: userPrimary.id,
    },
  });

  const projectSide = await prisma.project.create({
    data: {
      name: "Side Project",
      description: "Building modern Web apps with Next.js and Prisma",
      color: "#a855f7",
      icon: "rocket",
      userId: userPrimary.id,
    },
  });

  console.log("📁 Created Projects");

  // 7. Seed Tags
  const tagFrontend = await prisma.tag.create({
    data: { name: "Frontend", color: "#60a5fa", userId: userPrimary.id },
  });

  const tagDatabase = await prisma.tag.create({
    data: { name: "Database", color: "#f59e0b", userId: userPrimary.id },
  });

  const tagCritical = await prisma.tag.create({
    data: { name: "Critical", color: "#ef4444", userId: userPrimary.id },
  });

  console.log("🏷️ Created Tags");

  // 8. Seed Parent Todos
  const todo1 = await prisma.todo.create({
    data: {
      title: "Implement drag-and-drop fractional reordering",
      description:
        "Use position float column to allow seamless reordering without updating all index rows.",
      status: TodoStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      dueDate: new Date("2026-08-28T10:00:00Z"),
      reminderAt: new Date("2026-08-28T09:00:00Z"),
      estimatedMinutes: 120,
      actualMinutes: 45,
      isPinned: true,
      position: 1000.0,
      userId: userPrimary.id,
      projectId: projectSide.id,
    },
  });

  const todo2 = await prisma.todo.create({
    data: {
      title: "Configure MySQL composite indexes for high-read throughput",
      description:
        "Index (userId, status) and (userId, dueDate) for quick sidebar filtering.",
      status: TodoStatus.TODO,
      priority: Priority.URGENT,
      dueDate: new Date("2026-08-27T18:00:00Z"),
      estimatedMinutes: 60,
      actualMinutes: 0,
      isPinned: false,
      position: 2000.0,
      userId: userPrimary.id,
      projectId: projectWork.id,
    },
  });

  const todo3 = await prisma.todo.create({
    data: {
      title: "Setup RRULE recurrence parser for repeating tasks",
      description: "Integrate rrule.js to generate next instance when completed.",
      status: TodoStatus.COMPLETED,
      priority: Priority.MEDIUM,
      dueDate: new Date("2026-08-26T12:00:00Z"),
      completedAt: new Date("2026-08-26T11:45:00Z"),
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      estimatedMinutes: 90,
      actualMinutes: 85,
      isPinned: false,
      position: 3000.0,
      userId: userPrimary.id,
      projectId: projectPersonal.id,
    },
  });

  // 9. Seed Subtasks (Self-referencing parentId hierarchy)
  const subtask1 = await prisma.todo.create({
    data: {
      title: "Research dnd-kit library compatibility",
      status: TodoStatus.COMPLETED,
      priority: Priority.MEDIUM,
      position: 100.0,
      userId: userPrimary.id,
      projectId: projectSide.id,
      parentId: todo1.id,
    },
  });

  const subtask2 = await prisma.todo.create({
    data: {
      title: "Implement Lexorank position updates on drag end",
      status: TodoStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      position: 200.0,
      userId: userPrimary.id,
      projectId: projectSide.id,
      parentId: todo1.id,
    },
  });

  console.log("📋 Created Parent & Subtask Todos");

  // 10. Seed Todo-Tag Relations (TodoTag Join Table)
  await prisma.todoTag.createMany({
    data: [
      { todoId: todo1.id, tagId: tagFrontend.id },
      { todoId: todo2.id, tagId: tagDatabase.id },
      { todoId: todo2.id, tagId: tagCritical.id },
    ],
  });

  console.log("🔗 Linked Todo Tags");

  // 11. Seed Attachments
  await prisma.attachment.createMany({
    data: [
      {
        name: "positioning-architecture.png",
        url: "https://files.example.com/specs/pos-arch.png",
        fileType: "image/png",
        fileSize: 1024500,
        todoId: todo1.id,
      },
      {
        name: "query-explain-plan.json",
        url: "https://files.example.com/db/explain.json",
        fileType: "application/json",
        fileSize: 420100,
        todoId: todo2.id,
      },
    ],
  });

  console.log("📎 Created Attachments");

  // 12. Seed Activity Logs
  await prisma.activityLog.createMany({
    data: [
      {
        action: "TASK_CREATED",
        details: JSON.stringify({ title: todo1.title, priority: "HIGH" }),
        todoId: todo1.id,
        userId: userPrimary.id,
      },
      {
        action: "STATUS_CHANGED",
        details: JSON.stringify({ from: "TODO", to: "IN_PROGRESS" }),
        todoId: todo1.id,
        userId: userPrimary.id,
      },
      {
        action: "SUBTASK_ADDED",
        details: JSON.stringify({ subtaskId: subtask1.id }),
        todoId: todo1.id,
        userId: userPrimary.id,
      },
      {
        action: "STATUS_CHANGED",
        details: JSON.stringify({ from: "IN_PROGRESS", to: "COMPLETED" }),
        todoId: todo3.id,
        userId: userPrimary.id,
      },
    ],
  });

  console.log("📜 Created Activity Logs");
  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });