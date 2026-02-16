#ifndef YAJE_CORE_H
#define YAJE_CORE_H
#include "quickjs.h"

extern size_t JS_BUNDLE_LENGTH;
extern unsigned char JS_BUNDLE_DATA[];

void yaje_core_ctor(JSRuntime **rt, JSContext **ctx);

int yaje_core_execute(JSRuntime *rt, JSContext *ctx);

void yaje_core_free(JSRuntime **rt, JSContext **ctx);

JSValue yaje_core_get_native_map(JSContext *ctx);

void yaje_core_register_native(JSContext *ctx, JSValue obj, char* name);

#endif