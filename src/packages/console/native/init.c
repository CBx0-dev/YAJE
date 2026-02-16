#include "quickjs.h"
#include <stdio.h>

static JSValue console_log(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    for (int i = 0; i < argc; i++) {
        const char *str = JS_ToCString(ctx, argv[i]);
        if (str) {
            printf("%s%s", str, i == argc - 1 ? "" : " ");
            JS_FreeCString(ctx, str);
        }
    }
    printf("\n");
    return JS_UNDEFINED;
}

static JSValue console_error(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    for (int i = 0; i < argc; i++) {
        const char *str = JS_ToCString(ctx, argv[i]);
        if (str) {
            fprintf(stderr, "%s%s", str, i == argc - 1 ? "" : " ");
            JS_FreeCString(ctx, str);
        }
    }
    fprintf(stderr, "\n");
    return JS_UNDEFINED;
}

static JSValue console_info(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    return console_log(ctx, this_val, argc, argv);
}

static JSValue console_warn(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    return console_log(ctx, this_val, argc, argv);
}

static JSValue console_assert(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    if (argc > 0 && !JS_ToBool(ctx, argv[0])) {
        fprintf(stderr, "Assertion failed: ");
        for (int i = 1; i < argc; i++) {
            const char *str = JS_ToCString(ctx, argv[i]);
            if (str) {
                fprintf(stderr, "%s%s", str, i == argc - 1 ? "" : " ");
                JS_FreeCString(ctx, str);
            }
        }
        fprintf(stderr, "\n");
    }
    return JS_UNDEFINED;
}

static JSValue console_trace(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    // Basic implementation as requested: "Use JS_ToCString to get a string representation for now."
    printf("Trace:");
    for (int i = 0; i < argc; i++) {
        const char *str = JS_ToCString(ctx, argv[i]);
        if (str) {
            printf(" %s", str);
            JS_FreeCString(ctx, str);
        }
    }
    printf("\n");
    return JS_UNDEFINED;
}

void yaje_console_init(JSRuntime *rt, JSContext *ctx) {
    JSValue global_obj = JS_GetGlobalObject(ctx);
    JSValue console = JS_NewObject(ctx);

    JS_SetPropertyStr(ctx, console, "log", JS_NewCFunction(ctx, console_log, "log", 1));
    JS_SetPropertyStr(ctx, console, "error", JS_NewCFunction(ctx, console_error, "error", 1));
    JS_SetPropertyStr(ctx, console, "info", JS_NewCFunction(ctx, console_info, "info", 1));
    JS_SetPropertyStr(ctx, console, "warn", JS_NewCFunction(ctx, console_warn, "warn", 1));
    JS_SetPropertyStr(ctx, console, "assert", JS_NewCFunction(ctx, console_assert, "assert", 1));
    JS_SetPropertyStr(ctx, console, "trace", JS_NewCFunction(ctx, console_trace, "trace", 1));

    JS_SetPropertyStr(ctx, global_obj, "console", console);
    JS_FreeValue(ctx, global_obj);
}