/**
 * Reads versionName / versionCode from an APK entirely in the browser.
 *
 * Only the zip central directory and the compressed AndroidManifest.xml are read
 * from the File (usually well under 1 MB), so large APKs no longer have to be
 * uploaded just to auto-detect their version.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const MANIFEST_PATH = 'AndroidManifest.xml';

// Android binary XML chunk and value types
const RES_XML_TYPE = 0x0003;
const RES_STRING_POOL_TYPE = 0x0001;
const RES_XML_RESOURCE_MAP_TYPE = 0x0180;
const RES_XML_START_ELEMENT_TYPE = 0x0102;
const UTF8_FLAG = 0x100;
const TYPE_REFERENCE = 0x01;
const TYPE_STRING = 0x03;
const TYPE_INT_DEC = 0x10;
const TYPE_INT_HEX = 0x11;
const NO_INDEX = 0xffffffff;

// Framework resource IDs of android:versionCode / android:versionName
const ATTR_VERSION_CODE = 0x0101021b;
const ATTR_VERSION_NAME = 0x0101021c;

const readBytes = async (file, start, end) => new DataView(await file.slice(start, end).arrayBuffer());

const findManifestEntry = async (file) => {
    // End of central directory record: last 22 bytes + up to 64 KB of comment
    const tailStart = Math.max(0, file.size - 65557);
    const tail = await readBytes(file, tailStart, file.size);
    let eocd = -1;
    for (let i = tail.byteLength - 22; i >= 0; i--) {
        if (tail.getUint32(i, true) === EOCD_SIGNATURE) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) throw new Error('Not a valid APK file');

    const centralDirectorySize = tail.getUint32(eocd + 12, true);
    const centralDirectoryOffset = tail.getUint32(eocd + 16, true);
    if (centralDirectoryOffset === NO_INDEX || centralDirectorySize === NO_INDEX) {
        throw new Error('ZIP64 APKs are not supported');
    }

    const cd = await readBytes(file, centralDirectoryOffset, centralDirectoryOffset + centralDirectorySize);
    const decoder = new TextDecoder();
    let p = 0;
    while (p + 46 <= cd.byteLength && cd.getUint32(p, true) === CENTRAL_DIRECTORY_SIGNATURE) {
        const nameLength = cd.getUint16(p + 28, true);
        const name = decoder.decode(new Uint8Array(cd.buffer, p + 46, nameLength));
        if (name === MANIFEST_PATH) {
            return {
                method: cd.getUint16(p + 10, true),
                compressedSize: cd.getUint32(p + 20, true),
                localHeaderOffset: cd.getUint32(p + 42, true),
            };
        }
        p += 46 + nameLength + cd.getUint16(p + 30, true) + cd.getUint16(p + 32, true);
    }
    throw new Error('AndroidManifest.xml not found in APK');
};

const readManifestBytes = async (file) => {
    const { method, compressedSize, localHeaderOffset } = await findManifestEntry(file);
    const header = await readBytes(file, localHeaderOffset, localHeaderOffset + 30);
    if (header.getUint32(0, true) !== LOCAL_HEADER_SIGNATURE) throw new Error('Corrupt APK file');

    const dataStart = localHeaderOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
    const compressed = file.slice(dataStart, dataStart + compressedSize);
    if (method === 0) return new DataView(await compressed.arrayBuffer());
    if (method !== 8) throw new Error(`Unsupported APK compression method ${method}`);

    const inflated = compressed.stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new DataView(await new Response(inflated).arrayBuffer());
};

const readStringPool = (view, start) => {
    const headerSize = view.getUint16(start + 2, true);
    const count = view.getUint32(start + 8, true);
    const utf8 = (view.getUint32(start + 16, true) & UTF8_FLAG) !== 0;
    const stringsStart = start + view.getUint32(start + 20, true);
    const decoder = new TextDecoder(utf8 ? 'utf-8' : 'utf-16le');

    const strings = new Array(count);
    for (let i = 0; i < count; i++) {
        let p = stringsStart + view.getUint32(start + headerSize + i * 4, true);
        let byteLength;
        if (utf8) {
            p += view.getUint8(p) & 0x80 ? 2 : 1; // skip character count
            byteLength = view.getUint8(p);
            if (byteLength & 0x80) {
                byteLength = ((byteLength & 0x7f) << 8) | view.getUint8(p + 1);
                p += 2;
            } else {
                p += 1;
            }
        } else {
            let length = view.getUint16(p, true);
            if (length & 0x8000) {
                length = ((length & 0x7fff) << 16) | view.getUint16(p + 2, true);
                p += 4;
            } else {
                p += 2;
            }
            byteLength = length * 2;
        }
        strings[i] = decoder.decode(new Uint8Array(view.buffer, p, byteLength));
    }
    return strings;
};

const readManifestAttributes = (view, ext, strings, resourceIds) => {
    const attributeStart = view.getUint16(ext + 8, true);
    const attributeSize = view.getUint16(ext + 10, true);
    const attributeCount = view.getUint16(ext + 12, true);
    const info = { versionName: null, versionCode: null, packageName: null };

    for (let i = 0; i < attributeCount; i++) {
        const a = ext + attributeStart + i * attributeSize;
        const nameIndex = view.getUint32(a + 4, true);
        const rawValue = view.getUint32(a + 8, true);
        const dataType = view.getUint8(a + 15);
        const data = view.getUint32(a + 16, true);
        const name = strings[nameIndex];
        const resourceId = resourceIds[nameIndex];
        const stringValue = rawValue !== NO_INDEX
            ? strings[rawValue]
            : dataType === TYPE_STRING ? strings[data] : null;

        if (resourceId === ATTR_VERSION_CODE || name === 'versionCode') {
            if (dataType === TYPE_INT_DEC || dataType === TYPE_INT_HEX) {
                info.versionCode = data;
            } else if (stringValue) {
                info.versionCode = parseInt(stringValue, 10);
            }
        } else if (resourceId === ATTR_VERSION_NAME || name === 'versionName') {
            // A @string/ reference would need resources.arsc; leave null so callers can fall back.
            if (dataType !== TYPE_REFERENCE) info.versionName = stringValue;
        } else if (name === 'package') {
            info.packageName = stringValue;
        }
    }
    return info;
};

const parseManifest = (view) => {
    if (view.getUint16(0, true) !== RES_XML_TYPE) throw new Error('Unexpected AndroidManifest.xml format');

    let strings = [];
    let resourceIds = [];
    let offset = view.getUint16(2, true);
    while (offset + 8 <= view.byteLength) {
        const type = view.getUint16(offset, true);
        const headerSize = view.getUint16(offset + 2, true);
        const size = view.getUint32(offset + 4, true);
        if (size < 8) break;

        if (type === RES_STRING_POOL_TYPE) {
            strings = readStringPool(view, offset);
        } else if (type === RES_XML_RESOURCE_MAP_TYPE) {
            const count = (size - headerSize) / 4;
            resourceIds = Array.from({ length: count }, (_, i) => view.getUint32(offset + headerSize + i * 4, true));
        } else if (type === RES_XML_START_ELEMENT_TYPE) {
            const ext = offset + headerSize;
            if (strings[view.getUint32(ext + 4, true)] === 'manifest') {
                return readManifestAttributes(view, ext, strings, resourceIds);
            }
        }
        offset += size;
    }
    throw new Error('<manifest> element not found in AndroidManifest.xml');
};

/**
 * @param {Blob} file The selected .apk file
 * @returns {Promise<{versionName: string|null, versionCode: number|null, packageName: string|null}>}
 */
export const readApkVersion = async (file) => parseManifest(await readManifestBytes(file));
