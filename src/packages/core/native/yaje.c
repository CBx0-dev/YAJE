#include "yaje.h"

#include <stdlib.h>

typedef struct {
    JSValue native_map;
} YajeContextData;

void yaje_core_ctor(JSRuntime **rt, JSContext **ctx) {
    *rt = JS_NewRuntime();
    if (*rt == NULL) {
        fprintf(stderr, "Could not init Runtime: Could not init global runtime\n");
        exit(1);
    }

    *ctx = JS_NewContext(*rt);
    if (*ctx == NULL) {
        fprintf(stderr, "Could not init Runtime: Could not init global context\n");
        exit(1);
    }

    YajeContextData *data = malloc(sizeof(YajeContextData));
    data->native_map = JS_UNDEFINED;
    JS_SetContextOpaque(*ctx, data);
}

int yaje_core_execute(JSRuntime *rt, JSContext *ctx) {
    JSValue result = JS_Eval(ctx, (const char *)JS_BUNDLE_DATA, JS_BUNDLE_LENGTH, "<bundle>", JS_EVAL_TYPE_MODULE);
    if (JS_IsException(result)) {
        JSValue exception = JS_GetException(ctx);

        const char *error_str = JS_ToCString(ctx, exception);
        fprintf(stderr, "%s", error_str);

        JS_FreeCString(ctx, error_str);
        JS_FreeValue(ctx, exception);
        JS_FreeValue(ctx, result);

        return 1;
    }

    JS_FreeValue(ctx, result);
    return 0;
}

void yaje_core_free(JSRuntime **rt, JSContext **ctx) {
    if (*ctx != NULL) {
        YajeContextData *data = JS_GetContextOpaque(*ctx);
        if (data) {
            JS_FreeValue(*ctx, data->native_map);
            free(data);
            JS_SetContextOpaque(*ctx, NULL);
        }

        JS_FreeContext(*ctx);
        *ctx = NULL;
    }

    if (*rt != NULL) {
        JS_FreeRuntime(*rt);
        *rt = NULL;
    }
}

JSValue yaje_core_get_native_map(JSContext *ctx) {
    YajeContextData *data = JS_GetContextOpaque(ctx);
    if (!data) {
        return JS_ThrowInternalError(ctx, "Could not retrive opaque metadata");
    }

    if (JS_IsUndefined(data->native_map)) {
        data->native_map = JS_NewObject(ctx);
    }
    
    return JS_DupValue(ctx, data->native_map);
}

void yaje_core_register_native(JSContext *ctx, JSValue obj, char* name) {
    JSValue native_map = yaje_core_get_native_map(ctx);
    if (JS_IsException(native_map)) {
        return;
    }

    JS_SetPropertyStr(ctx, native_map, name, obj);
    JS_FreeValue(ctx, native_map);
}