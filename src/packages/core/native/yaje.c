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

static inline void print_exception(JSContext* ctx) {
    JSValue exception = JS_GetException(ctx);

    const char *error_str = JS_ToCString(ctx, exception);
    if (error_str) {
        fprintf(stderr, "%s\n", error_str);
        JS_FreeCString(ctx, error_str);
    } else {
        fprintf(stderr, "An unknown error occurred\n");
    }

    JSValue stack = JS_GetPropertyStr(ctx, exception, "stack");
    if (!JS_IsUndefined(stack)) {
        const char *stack_str = JS_ToCString(ctx, stack);
        if (stack_str) {
            fprintf(stderr, "%s\n", stack_str);
            JS_FreeCString(ctx, stack_str);
        }
    }
    JS_FreeValue(ctx, stack);

    JS_FreeValue(ctx, exception);
}

int yaje_core_execute(JSRuntime *rt, JSContext *ctx) {
    JSValue module = JS_Eval(ctx, (const char *)JS_BUNDLE_DATA, JS_BUNDLE_LENGTH, "<bundle>", JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
    if (JS_IsException(module)) {
        print_exception(ctx);
        JS_FreeValue(ctx, module);
        return 1;
    }

    if (yaje_set_import_meta(ctx, module, false, true) < 0) {
        print_exception(ctx);
        JS_FreeValue(ctx, module);
        return 1;
    }

    JSValue ret = JS_EvalFunction(ctx, module);
    if (JS_IsException(ret)) {
        print_exception(ctx);
        JS_FreeValue(ctx, ret);
        return 1;
    }

    JS_FreeValue(ctx, ret);
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

int yaje_set_import_meta(JSContext* ctx, JSValueConst func_val, bool use_realpath, bool is_main) {
    JSModuleDef *m;
    char buf[JS__PATH_MAX + 16];
    JSValue meta_obj;
    JSAtom module_name_atom;
    const char *module_name;

    assert(JS_VALUE_GET_TAG(func_val) == JS_TAG_MODULE);
    m = JS_VALUE_GET_PTR(func_val);

    module_name_atom = JS_GetModuleName(ctx, m);
    module_name = JS_AtomToCString(ctx, module_name_atom);
    JS_FreeAtom(ctx, module_name_atom);
    if (!module_name) {
        return -1;
    }

    if (!strchr(module_name, ':')) {
        strcpy(buf, "file://");
#if !defined(_WIN32) && !defined(__wasi__)
        /* realpath() cannot be used with modules compiled with qjsc
           because the corresponding module source code is not
           necessarily present */
        if (use_realpath) {
            char *res = realpath(module_name, buf + strlen(buf));
            if (!res) {
                JS_ThrowTypeError(ctx, "realpath failure");
                JS_FreeCString(ctx, module_name);
                return -1;
            }
        } else
#endif
        {
            js__pstrcat(buf, sizeof(buf), module_name);
        }
    } else {
        js__pstrcpy(buf, sizeof(buf), module_name);
    }
    JS_FreeCString(ctx, module_name);

    meta_obj = JS_GetImportMeta(ctx, m);
    if (JS_IsException(meta_obj))
        return -1;
    JS_DefinePropertyValueStr(ctx, meta_obj, "url",
                              JS_NewString(ctx, buf),
                              JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, meta_obj, "main",
                              JS_NewBool(ctx, is_main),
                              JS_PROP_C_W_E);
    JS_FreeValue(ctx, meta_obj);
    return 0;
}
