import type { FastifyInstance } from 'fastify';
import type { PrismaClient, Project as StoredProject } from '@repo/db';
import type { Project } from '@repo/types';
import { z } from 'zod';
import { requireUser } from '../lib/auth';
import { AppError } from '../lib/errors';
const fields = {
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  status: z.enum(['PLANNED', 'ACTIVE', 'DONE'])
};
const createInput = z
  .object({
    title: fields.title,
    description: fields.description.default(''),
    status: fields.status.default('PLANNED')
  })
  .strict();
const updateInput = z
  .object(fields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);
const identifier = z.object({ id: z.string().min(1).max(64) });
function publicProject(project: StoredProject): Project {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    status: fields.status.parse(project.status),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}
export function projectRoutes(app: FastifyInstance, db: PrismaClient) {
  app.get('/api/projects', async (req) => {
    const ownerId = requireUser(req).id;
    const projects = await db.project.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return { data: projects.map(publicProject) };
  });
  app.post('/api/projects', async (req, reply) => {
    const ownerId = requireUser(req).id;
    const input = createInput.safeParse(req.body);
    if (!input.success)
      throw new AppError(
        400,
        'INVALID_INPUT',
        'Provide a title (1–120 characters), description (up to 2000) and valid status.'
      );
    const project = await db.project.create({ data: { ...input.data, ownerId } });
    return reply.code(201).send({ data: publicProject(project) });
  });
  app.get('/api/projects/:id', async (req) => {
    const ownerId = requireUser(req).id;
    const params = identifier.safeParse(req.params);
    if (!params.success) throw new AppError(400, 'INVALID_INPUT', 'Invalid project identifier.');
    const project = await db.project.findFirst({ where: { id: params.data.id, ownerId } });
    if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found.');
    return { data: publicProject(project) };
  });
  app.patch('/api/projects/:id', async (req) => {
    const ownerId = requireUser(req).id;
    const params = identifier.safeParse(req.params);
    const input = updateInput.safeParse(req.body);
    if (!params.success || !input.success)
      throw new AppError(400, 'INVALID_INPUT', 'Provide valid project changes.');
    return db.$transaction(async (tx) => {
      const result = await tx.project.updateMany({
        where: { id: params.data.id, ownerId },
        data: input.data
      });
      if (!result.count) throw new AppError(404, 'NOT_FOUND', 'Project not found.');
      return {
        data: publicProject(await tx.project.findUniqueOrThrow({ where: { id: params.data.id } }))
      };
    });
  });
  app.delete('/api/projects/:id', async (req, reply) => {
    const ownerId = requireUser(req).id;
    const params = identifier.safeParse(req.params);
    if (!params.success) throw new AppError(400, 'INVALID_INPUT', 'Invalid project identifier.');
    const result = await db.project.deleteMany({ where: { id: params.data.id, ownerId } });
    if (!result.count) throw new AppError(404, 'NOT_FOUND', 'Project not found.');
    return reply.code(204).send();
  });
}
