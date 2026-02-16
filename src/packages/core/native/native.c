#include "native.h"

static JSValue yaje_native_get_module(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "getModule expects 1 argument");
    }

    const char *identifier = JS_ToCString(ctx, argv[0]);
    if (!identifier) {
        return JS_EXCEPTION;
    }

    JSValue native_map = yaje_core_get_native_map(ctx);
    if (JS_IsException(native_map)) {
        JS_FreeCString(ctx, identifier);
        return JS_EXCEPTION;
    }

    JSValue module = JS_GetPropertyStr(ctx, native_map, identifier);
    JS_FreeValue(ctx, native_map);

    if (JS_IsUndefined(module)) {
        JS_FreeCString(ctx, identifier);
        return JS_ThrowTypeError(ctx, "Module '%s' not found", identifier);
    }

    JS_FreeCString(ctx, identifier);
    return module;
}

void yaje_core_native_init(JSRuntime* rt, JSContext *ctx) {
    JSValue global_obj = JS_GetGlobalObject(ctx);
    JSValue native_obj = JS_NewObject(ctx);

    JS_SetPropertyStr(ctx, native_obj, "getModule", JS_NewCFunction(ctx, yaje_native_get_module, "getModule", 1));
    JS_SetPropertyStr(ctx, global_obj, "Native", native_obj);

    JS_FreeValue(ctx, global_obj);
}
