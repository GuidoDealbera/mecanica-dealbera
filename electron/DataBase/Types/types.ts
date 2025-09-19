export interface ApiResponse {
    status: 'failed' | 'success',
    message: string,
    result?: any
}