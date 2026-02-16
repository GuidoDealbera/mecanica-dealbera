/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ApiResponse {
    status: 'failed' | 'success',
    message: string,
    result?: any
}