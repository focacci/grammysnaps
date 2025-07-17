import { FastifyPluginAsync, FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { Image } from '../types/image.types'

interface ImageInput {
    filename?: string
    s3_url?: string
}

declare module 'fastify' {
    interface FastifyInstance {
        image: {
            create: (input: ImageInput) => Promise<Image>
            get: () => Promise<Image[]>
            // getById: (id: number) => Promise<Image | null>
            // update: (id: number, input: ImageInput) => Promise<Image | null>
            // delete: (id: number) => Promise<boolean>
        }
    }
}

const imagePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    if (!fastify.pg) {
        throw new Error('fastify-postgres must be registered before this plugin');
    }

    fastify.decorate('image', {
        async create(input: ImageInput): Promise<Image> {
            const { filename } = input;
            try {
                const { rows } = await fastify.pg.query<Image>(
                  'INSERT INTO images (filename) VALUES ($1) RETURNING *',
                  [filename]
                )
                return rows[0]
            } catch (err) {
                fastify.log.error(err)
                throw new Error('Failed to create image')
            }
        },

        async get(): Promise<Image[]> {
            try {
                const { rows } = await fastify.pg.query<Image>('SELECT * FROM images')
                return rows
            } catch (err) {
                fastify.log.error(err)
                throw new Error('Failed to fetch images')
            }
        },

        // async getById(id: number): Promise<Image | null> {},

        // async update(id: number, input: ImageInput): Promise<Image | null> {},

        // async delete(id: number): Promise<boolean> {}
    });
}

export default fp(imagePlugin, { name: 'image' })