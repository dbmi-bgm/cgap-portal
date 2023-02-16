foo_dispatcher.py

    FOOS = []

    def call_foo(key):
	FOOS[key]()

    def register_foo(key):
        "decorator to register a foo function"
        def _register(fn):
	    FOOS[key] = fn
	    return fn
	return _register


foo_caller.py

    from foo_dispatcher import call_foo

    def whatever(x):
        ... call_foo(x) ...
	
foo_handlers1.py

    from foo_dispatcher import register_foo

    @register_foo('something1')
    def do_something1():
        ...

    @register_foo('something2')
    def do_something2():
        ...

foo_handlers2.py

    from foo_dispatcher import register_foo

    @register_foo('something3')
    def do_something3():
        ...

    @register_foo('something4')
    def do_something4():
        ...

so that no matter how many handlers files, including 0, get loaded, the core foo_caller will still work. and you can understand the whole of what the foo_dispatcher is doing by reading
