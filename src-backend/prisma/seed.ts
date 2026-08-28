import { hashPassword } from 'better-auth/crypto';
import { prisma } from "../src/db";
import { Priority, TodoStatus } from "../src/generated/prisma/enums";

async function main() {
  console.log("🌱 Starting expanded database seeding (~20 records per table)...");

  // 1. Clean up existing data in relational dependency order
  await prisma.activityLog.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.todoTag.deleteMany();
  await prisma.todo.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.project.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.session.deleteMany(); // Kept empty after cleanup
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("🧹 Cleaned existing database records.");

  const hashedPassword = await hashPassword("123456789");

  // 2. Seed Users (20 records)
  const userData = Array.from({ length: 20 }).map((_, i) => ({
    id: crypto.randomUUID(),
    name: `User ${i + 1}`,
    email: `user${i + 1}@dev.io`,
    emailVerified: i % 2 === 0,
    image: `https://avatar.vercel.sh/user${i + 1}`,
  }));

  await prisma.user.createMany({ data: userData });
  const users = await prisma.user.findMany();
  const primaryUserId = users[0].id;
  console.log(`👤 Created ${users.length} Users`);

  // 3. Seed Accounts (20 records - 1 per user)
  const accountData = users.map((u) => ({
    id: crypto.randomUUID(),
    issuer: "local:credential",
    accountId: u.id,
    providerId: "credential",
    userId: u.id,
    password: hashedPassword,
  }));

  await prisma.account.createMany({ data: accountData });
  console.log("🔐 Created 20 Accounts");

  // 4. Seed Verifications (20 records)
  const verificationData = users.map((u, i) => ({
    id: crypto.randomUUID(),
    identifier: u.email,
    value: `verify-token-${i + 1}-${crypto.randomUUID().slice(0, 8)}`,
    expiresAt: new Date(Date.now() + 86400000 * (i + 1)),
  }));

  await prisma.verification.createMany({ data: verificationData });
  console.log("🔑 Created 20 Verifications");

  // 5. Seed Projects (20 records)
  const colors = ["#3b82f6", "#10b981", "#a855f7", "#ef4444", "#f59e0b", "#6366f1"];
  const icons = ["briefcase", "user", "rocket", "code", "folder", "terminal"];

  const projectData = Array.from({ length: 20 }).map((_, i) => ({
    id: crypto.randomUUID(),
    name: `Project ${i + 1}`,
    description: `Workspace description for project bundle #${i + 1}`,
    color: colors[i % colors.length],
    icon: icons[i % icons.length],
    userId: users[i % users.length].id,
  }));

  await prisma.project.createMany({ data: projectData });
  const projects = await prisma.project.findMany();
  console.log(`📁 Created ${projects.length} Projects`);

  // 6. Seed Tags (20 records)
  const tagNames = [
    "Frontend", "Database", "Critical", "Backend", "DevOps", 
    "UI/UX", "Bug", "Feature", "Refactor", "Security",
    "Docs", "Testing", "API", "Performance", "Auth",
    "Mobile", "CI/CD", "Design", "Urgent", "Backlog"
  ];

  const tagData = tagNames.map((name, i) => ({
    id: crypto.randomUUID(),
    name,
    color: colors[i % colors.length],
    userId: users[i % users.length].id,
  }));

  await prisma.tag.createMany({ data: tagData });
  const tags = await prisma.tag.findMany();
  console.log(`🏷️ Created ${tags.length} Tags`);

  // 7. Seed Parent Todos (15 records)
  const statuses = [TodoStatus.TODO, TodoStatus.IN_PROGRESS, TodoStatus.COMPLETED];
  const priorities = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.URGENT];

  const parentTodoData = Array.from({ length: 15 }).map((_, i) => ({
    id: crypto.randomUUID(),
    title: `Task #${i + 1}: System Architecture & Integration`,
    description: `Detailed description for engineering backlog task unit #${i + 1}`,
    status: statuses[i % statuses.length],
    priority: priorities[i % priorities.length],
    dueDate: new Date(Date.now() + 86400000 * (i + 1)),
    reminderAt: new Date(Date.now() + 43200000 * (i + 1)),
    estimatedMinutes: (i + 1) * 30,
    actualMinutes: i % 2 === 0 ? (i + 1) * 20 : 0,
    isPinned: i % 3 === 0,
    position: (i + 1) * 1000.0,
    userId: users[i % users.length].id,
    projectId: projects[i % projects.length].id,
  }));

  await prisma.todo.createMany({ data: parentTodoData });
  const parentTodos = await prisma.todo.findMany({ where: { parentId: null } });

  // 8. Seed Subtasks (5 records -> 20 total Todos)
  const subtaskData = Array.from({ length: 5 }).map((_, i) => ({
    id: crypto.randomUUID(),
    title: `Subtask #${i + 1} for ${parentTodos[i % parentTodos.length].title.slice(0, 15)}...`,
    status: statuses[i % statuses.length],
    priority: priorities[i % priorities.length],
    position: (i + 1) * 100.0,
    userId: parentTodos[i % parentTodos.length].userId,
    projectId: parentTodos[i % parentTodos.length].projectId,
    parentId: parentTodos[i % parentTodos.length].id,
  }));

  await prisma.todo.createMany({ data: subtaskData });
  const allTodos = await prisma.todo.findMany();
  console.log(`📋 Created ${allTodos.length} Total Todos (15 Parent + 5 Subtasks)`);

  // 9. Seed TodoTag Join Table (20 records)
  const todoTagPairs = new Set<string>();
  const todoTagData: { todoId: string; tagId: string }[] = [];

  let attempts = 0;
  while (todoTagData.length < 20 && attempts < 200) {
    attempts++;
    const randomTodo = allTodos[Math.floor(Math.random() * allTodos.length)];
    const randomTag = tags[Math.floor(Math.random() * tags.length)];
    const pairKey = `${randomTodo.id}_${randomTag.id}`;

    if (!todoTagPairs.has(pairKey)) {
      todoTagPairs.add(pairKey);
      todoTagData.push({ todoId: randomTodo.id, tagId: randomTag.id });
    }
  }

  await prisma.todoTag.createMany({ data: todoTagData });
  console.log(`🔗 Created ${todoTagData.length} Todo-Tag Link Records`);

  // 10. Seed Attachments (20 records)
  const fileTypes = [
    { type: "image/png", ext: "png" },
    { type: "application/json", ext: "json" },
    { type: "application/pdf", ext: "pdf" },
    { type: "text/plain", ext: "txt" },
  ];

  const attachmentData = Array.from({ length: 20 }).map((_, i) => {
    const file = fileTypes[i % fileTypes.length];
    return {
      id: crypto.randomUUID(),
      name: `attachment-spec-${i + 1}.${file.ext}`,
      url: `https://files.example.com/docs/attachment-${i + 1}.${file.ext}`,
      fileType: file.type,
      fileSize: 102400 * (i + 1),
      todoId: allTodos[i % allTodos.length].id,
    };
  });

  await prisma.attachment.createMany({ data: attachmentData });
  console.log("📎 Created 20 Attachments");

  // 11. Seed Activity Logs (20 records)
  const actions = ["TASK_CREATED", "STATUS_CHANGED", "SUBTASK_ADDED", "PRIORITY_UPDATED", "TITLE_EDITED"];

  const activityLogData = Array.from({ length: 20 }).map((_, i) => {
    const targetTodo = allTodos[i % allTodos.length];
    return {
      id: crypto.randomUUID(),
      action: actions[i % actions.length],
      details: JSON.stringify({
        todoId: targetTodo.id,
        actionIndex: i + 1,
        timestamp: new Date().toISOString(),
      }),
      todoId: targetTodo.id,
      userId: targetTodo.userId,
    };
  });

  await prisma.activityLog.createMany({ data: activityLogData });
  console.log("📜 Created 20 Activity Logs");

  console.log("🎉 Database seeding completed successfully with ~20 records per target table!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });