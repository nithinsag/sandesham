// tracer.ts
import tracer from "dd-trace";
if (process.env.DEPLOY_ENV == "production") tracer.init(); // initialized in a different file to avoid hoisting.
export default tracer;
