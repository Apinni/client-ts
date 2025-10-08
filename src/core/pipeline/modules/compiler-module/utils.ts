import crypto from 'crypto';

export const getFileHash = (content: string) => {
    return crypto.createHash('sha256').update(content).digest('hex');
};
