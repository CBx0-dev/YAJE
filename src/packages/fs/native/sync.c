#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>

#include "quickjs.h"
#include "yaje.h"

static JSValue fs_open(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path;
    const char *mode;
    FILE *file;

    if (argc < 2) {
        return JS_ThrowTypeError(ctx, "Expected 2 arguments: path and mode");
    }

    path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    mode = JS_ToCString(ctx, argv[1]);
    if (!mode) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    file = fopen(path, mode);
    JS_FreeCString(ctx, path);
    JS_FreeCString(ctx, mode);

    if (!file) {
        return JS_ThrowInternalError(ctx, "Failed to open file: %s", strerror(errno));
    }

    return JS_NewInt64(ctx, (int64_t)(uintptr_t)file);
}

static JSValue fs_read(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    int64_t file_ptr;
    uint64_t size;
    FILE *file;
    char *buffer;

    if (argc < 2) {
        return JS_ThrowTypeError(ctx, "Expected 2 arguments: fd and length");
    }

    if (JS_ToInt64(ctx, &file_ptr, argv[0])) {
        return JS_EXCEPTION;
    }

    if (JS_ToIndex(ctx, &size, argv[1])) {
        return JS_EXCEPTION;
    }

    if (size == 0) {
        return JS_NewString(ctx, "");
    }

    file = (FILE *)(uintptr_t)file_ptr;
    if (!file) {
        return JS_ThrowTypeError(ctx, "Invalid fd");
    }

    buffer = (char *)malloc(size);
    if (!buffer) {
        return JS_ThrowInternalError(ctx, "Memory allocation failed");
    }

    size_t read_bytes = fread(buffer, 1, size, file);
    if (read_bytes < size && ferror(file)) {
        free(buffer);
        return JS_ThrowInternalError(ctx, "Failed to read from file");
    }

    JSValue result = JS_NewStringLen(ctx, buffer, read_bytes);
    free(buffer);
    return result;
}

static JSValue fs_write(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    int64_t file_ptr;
    const char *data;
    size_t length;
    FILE *file;

    if (argc < 2) {
        return JS_ThrowTypeError(ctx, "Expected 2 arguments: fd and data");
    }

    if (JS_ToInt64(ctx, &file_ptr, argv[0])) {
        return JS_EXCEPTION;
    }

    data = JS_ToCString(ctx, argv[1]);
    if (!data) {
        return JS_EXCEPTION;
    }

    length = strlen(data);
    file = (FILE *)(uintptr_t)file_ptr;

    if (!file) {
        JS_FreeCString(ctx, data);
        return JS_ThrowTypeError(ctx, "Invalid fd");
    }

    size_t written = fwrite(data, 1, length, file);
    JS_FreeCString(ctx, data);

    if (written != length) {
        return JS_ThrowInternalError(ctx, "Failed to write to file");
    }

    return JS_UNDEFINED;
}

static JSValue fs_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    int64_t file_ptr;
    FILE *file;

    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "Expected 1 argument: fd");
    }

    if (JS_ToInt64(ctx, &file_ptr, argv[0])) {
        return JS_EXCEPTION;
    }

    file = (FILE *)(uintptr_t)file_ptr;
    if (!file) {
        return JS_ThrowTypeError(ctx, "Invalid fd");
    }

    if (fclose(file) != 0) {
        return JS_ThrowInternalError(ctx, "Failed to close file");
    }

    return JS_UNDEFINED;
}

static JSValue fs_seek(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    int64_t file_ptr;
    FILE *file;
    int offset;
    int origin;

    if (argc < 3) {
        return JS_ThrowTypeError(ctx, "Expected 3 arguments: fd, offset and origin");
    }

    if (JS_ToInt64(ctx, &file_ptr, argv[0])) {
        return JS_EXCEPTION;
    }
    
    if (JS_ToInt32(ctx, &offset, argv[1])) {
        return JS_EXCEPTION;
    }

    if (JS_ToInt32(ctx, &origin, argv[2])) {
        return JS_EXCEPTION;
    }

    // Map JSSeek to real seek
    origin = (int[]){ SEEK_SET, SEEK_CUR, SEEK_END }[origin];

    file = (FILE *)(uintptr_t)file_ptr;
    if (!file) {
        return JS_ThrowTypeError(ctx, "Invalid fd");
    }

    if (origin < 0 || origin > 2) {
        return JS_ThrowTypeError(ctx, "Origin contains a invalid value");
    }

    if (fseek(file, offset, origin) == -1) {
        return JS_ThrowTypeError(ctx, "Failed to seek in file");
    }

    return JS_UNDEFINED;
}

static JSValue fs_tell(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    int64_t file_ptr;
    FILE *file;

    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "Expected 1 argument: fd");
    }

    if (JS_ToInt64(ctx, &file_ptr, argv[0])) {
        return JS_EXCEPTION;
    }

    file = (FILE *)(uintptr_t)file_ptr;
    if (!file) {
        return JS_ThrowTypeError(ctx, "Invalid fd");
    }

    return JS_NewInt32(ctx, ftell(file));
}

void yaje_fs_init(JSRuntime* rt, JSContext *ctx) {
    JSValue sync_fs = JS_NewObject(ctx);

    JS_SetPropertyStr(ctx, sync_fs, "open", JS_NewCFunction(ctx, fs_open, "open", 2));
    JS_SetPropertyStr(ctx, sync_fs, "read", JS_NewCFunction(ctx, fs_read, "read", 2));
    JS_SetPropertyStr(ctx, sync_fs, "write", JS_NewCFunction(ctx, fs_write, "write", 2));
    JS_SetPropertyStr(ctx, sync_fs, "close", JS_NewCFunction(ctx, fs_close, "close", 1));
    JS_SetPropertyStr(ctx, sync_fs, "seek", JS_NewCFunction(ctx, fs_seek, "seek", 3));
    JS_SetPropertyStr(ctx, sync_fs, "tell", JS_NewCFunction(ctx, fs_tell, "tell", 1));

    yaje_core_register_native(ctx, JS_DupValue(ctx, sync_fs), "fs.sync");
    JS_FreeValue(ctx, sync_fs);
}