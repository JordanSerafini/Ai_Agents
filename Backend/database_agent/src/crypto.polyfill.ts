// Polyfill pour le module crypto
import * as crypto from 'crypto';

// Rendre crypto disponible globalement
(global as any).crypto = crypto;

export default crypto;
