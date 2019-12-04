import allel
import sys


def main():
    f = sys.argv[1]
    parsed = allel.read_vcf(f, fields='*')
    print(parsed)

if __name__ == '__main__':
    main()
