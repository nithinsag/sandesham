import * as MainService from './controllers/main.service';
import * as UserService from './controllers/user.service';
import * as md_auth from './middlewares/authenticate';

import logger from 'morgan';
import fastify from 'fastify';
import fastifySwagger from 'fastify-swagger'
import cors from 'cors';
import middie from 'middie'

export class Server {

    public app: any;

    // TODO
    private opts = {
        schema: {}
    };

    constructor(private port: number) {
        this.app = fastify();
        
    }

    async start() {

        await this.config(); 
        await this.api();
        try {
            await this.app.listen(this.port, '0.0.0.0')
            console.log(`server listening on ${this.port}`);
        }
        catch (e) {
            console.log(e)
        }
    }

    public api() {
        this.app.get('/', function (req: any, res: any) {
            res.send('API is working!');
        });

        this.app.post('/register', this.opts, UserService.registerUser);
        this.app.get('/public', MainService.getPublic);
        this.app.get('/private', { preHandler: [md_auth.ensureAuth] }, MainService.getPrivate);



    }

    public async config() {

        await this.app.register(middie)
        console.log("registered middie for handling middleware")


        const options: cors.CorsOptions = {
            allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'X-Access-Token'],
            credentials: true,
            methods: 'GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE',
            // origin: API_URL,
            preflightContinue: false
        };

        this.app.use(cors(options));

        this.app.use(logger('dev'));


        this.app.register(fastifySwagger, {
            routePrefix: '/documentation',
            swagger: {
                info: {
                    title: 'Test swagger',
                    description: 'testing the fastify swagger api',
                    version: '0.1.0'
                },
                externalDocs: {
                    url: 'https://swagger.io',
                    description: 'Find more info here'
                },
                host: 'localhost',
                schemes: ['http'],
                consumes: ['application/json'],
                produces: ['application/json'],
                tags: [
                    { name: 'user', description: 'User related end-points' },
                    { name: 'code', description: 'Code related end-points' }
                ],
                definitions: {
                    User: {
                        type: 'object',
                        required: ['id', 'email'],
                        properties: {
                            id: { type: 'string', format: 'uuid' },
                            firstName: { type: 'string' },
                            lastName: { type: 'string' },
                            email: { type: 'string', format: 'email' }
                        }
                    }
                },
                securityDefinitions: {
                    apiKey: {
                        type: 'apiKey',
                        name: 'apiKey',
                        in: 'header'
                    }
                }
            },
            exposeRoute: true
        })
    }

}

