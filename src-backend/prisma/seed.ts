import { hashPassword } from 'better-auth/crypto';
import { prisma } from "../src/db";
import { Priority, TodoStatus } from "../src/generated/prisma/enums";

async function main() {
  console.log("🌱 Starting expanded database seeding (~20+ records per table with project variation)...");

  // Clean up existing data in relational dependency order
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

  const hashedPassword = await hashPassword("123456789");

  // Seed Users (20 records)
  const userData = Array.from({ length: 20 }).map((_, i) => ({
    id: crypto.randomUUID(),
    name: `User ${i + 1}`,
    email: `user${i + 1}@dev.io`,
    emailVerified: i % 2 === 0,
    image: `https://avatar.vercel.sh/user${i + 1}`,
  }));

  await prisma.user.createMany({ data: userData });
  const users = await prisma.user.findMany();
  console.log(`👤 Created ${users.length} Users`);

  // Seed Accounts (20 records - 1 per user)
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

  // Seed Projects (25 records distributed across users)
  const colors = ["#3b82f6", "#10b981", "#a855f7", "#ef4444", "#f59e0b", "#6366f1"];
  const icons = ["briefcase", "user", "rocket", "code", "folder", "terminal"];

  const projectData = Array.from({ length: 25 }).map((_, i) => ({
    id: crypto.randomUUID(),
    name: `Project Workspace ${i + 1}`,
    description: `Detailed workspace bundle description for project #${i + 1}`,
    color: colors[i % colors.length],
    icon: icons[i % icons.length],
    userId: users[i % users.length].id,
  }));

  await prisma.project.createMany({ data: projectData });
  const projects = await prisma.project.findMany();
  console.log(`📁 Created ${projects.length} Projects`);

  // Seed Tags (20 records)
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

  // Seed Todos (30 total: a mix of with project and without project)
  const statuses = [TodoStatus.IN_PROGRESS, TodoStatus.COMPLETED];
  const priorities = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.URGENT];

  const todoData = Array.from({ length: 30 }).map((_, i) => {
    const ownerUser = users[i % users.length];
    
    // Find projects owned by this specific user
    const userProjects = projects.filter((p) => p.userId === ownerUser.id);
    
    // Alternate between assigning a project (if available) or leaving it null (unassigned inbox task)
    const shouldAssignProject = i % 2 === 0 && userProjects.length > 0;
    const assignedProject = shouldAssignProject 
      ? userProjects[i % userProjects.length] 
      : null;

    return {
      id: crypto.randomUUID(),
      title: assignedProject 
        ? `Task #${i + 1}: Feature implementation for ${assignedProject.name}` 
        : `Independent Inbox Task #${i + 1} (No Project)`,
      description: `Comprehensive task scope documentation for execution item #${i + 1}`,
      status: statuses[i % statuses.length],
      priority: priorities[i % priorities.length],
      dueDate: new Date(Date.now() + 86400000 * (i + 1)),
      reminderAt: new Date(Date.now() + 43200000 * (i + 1)),
      estimatedMinutes: (i + 1) * 15,
      actualMinutes: i % 2 === 0 ? (i + 1) * 10 : 0,
      isPinned: i % 4 === 0,
      position: (i + 1) * 1000.0,
      userId: ownerUser.id,
      projectId: assignedProject ? assignedProject.id : null,
    };
  });

  await prisma.todo.createMany({ data: todoData });
  const allTodos = await prisma.todo.findMany();
  
  const connectedCount = allTodos.filter(t => t.projectId !== null).length;
  const unassignedCount = allTodos.filter(t => t.projectId === null).length;
  console.log(`📋 Created ${allTodos.length} Total Todos (${connectedCount} connected to projects, ${unassignedCount} independent/unassigned)`);

  // Seed TodoTag Join Table (25 records)
  const todoTagPairs = new Set<string>();
  const todoTagData: { todoId: string; tagId: string }[] = [];

  let attempts = 0;
  while (todoTagData.length < 25 && attempts < 300) {
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

  // Seed Attachments (20 records)
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
      name: `document-asset-${i + 1}.${file.ext}`,
      url: `https://files.example.com/vault/attachment-${i + 1}.${file.ext}`,
      fileType: file.type,
      fileSize: 102400 * (i + 1),
      todoId: allTodos[i % allTodos.length].id,
    };
  });

  await prisma.attachment.createMany({ data: attachmentData });
  console.log("📎 Created 20 Attachments");

  // Seed Activity Logs (25 records)
  const actions = ["TASK_CREATED", "STATUS_CHANGED", "PROJECT_ASSIGNED", "PRIORITY_UPDATED", "TITLE_EDITED"];

  const activityLogData = Array.from({ length: 25 }).map((_, i) => {
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
  console.log("📜 Created 25 Activity Logs");

  console.log("🎉 Database seeding completed successfully with full project-todo distribution!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });