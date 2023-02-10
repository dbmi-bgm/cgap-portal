import inspect

def f(x: int, y: str):
    pass

s = inspect.signature(f)
print(s)
print(s.parameters)
i = iter(s.parameters.items())
print(next(i))
print(next(i))
