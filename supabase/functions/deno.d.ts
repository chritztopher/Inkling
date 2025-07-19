// Deno type declarations for Edge Functions
declare namespace Deno {
    interface Env {
        get(key: string): string | undefined;
    }

    const env: Env;
}

// HTTP server types for Deno
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
    export function serve(handler: (request: Request) => Promise<Response> | Response): void;
}

// Supabase client types for Deno
declare module 'https://esm.sh/@supabase/supabase-js@2' {
    export function createClient(url: string, key: string): any;
}